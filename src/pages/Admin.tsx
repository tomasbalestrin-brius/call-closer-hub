import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { useAuditLog } from '@/hooks/useAuditLog';
import MainLayout from '@/components/layout/MainLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Users, 
  UserPlus, 
  Shield, 
  Mail, 
  Phone,
  CheckCircle,
  XCircle,
  Loader2,
  Users2,
  Target,
  Key
} from 'lucide-react';
import { toast } from 'sonner';
import { NewCloserDialog } from '@/components/admin/NewCloserDialog';
import { SquadManagement } from '@/components/admin/SquadManagement';
import { SquadMembersDialog } from '@/components/admin/SquadMembersDialog';
import { CloserLevelSelect, type CloserLevel } from '@/components/admin/CloserLevelSelect';
import { UserRoleSelect } from '@/components/admin/UserRoleSelect';
import { SetMonthlyGoalDialog } from '@/components/admin/SetMonthlyGoalDialog';
import { ResetPasswordDialog } from '@/components/admin/ResetPasswordDialog';
import { Navigate } from 'react-router-dom';
import { UserRole } from '@/types';

interface CloserWithProfile {
  id: string;
  user_id: string;
  full_name: string;
  phone: string | null;
  google_connected: boolean;
  google_email: string | null;
  status: string;
  closer_level: CloserLevel;
  created_at: string;
  role: UserRole;
}

interface LeaderSquad {
  id: string;
  name: string;
}

export default function Admin() {
  const { user } = useAuth();
  const { isAdmin, isLeader, loading: roleLoading } = useUserRole();
  const { logAction } = useAuditLog();
  const [closers, setClosers] = useState<CloserWithProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [goalDialogOpen, setGoalDialogOpen] = useState(false);
  const [resetPasswordDialogOpen, setResetPasswordDialogOpen] = useState(false);
  const [selectedCloserForReset, setSelectedCloserForReset] = useState<{ user_id: string; full_name: string } | null>(null);
  const [leaderSquad, setLeaderSquad] = useState<LeaderSquad | null>(null);
  const [squadMembersDialogOpen, setSquadMembersDialogOpen] = useState(false);

  useEffect(() => {
    if (isAdmin || isLeader) {
      if (isLeader && !isAdmin) {
        fetchLeaderSquad();
      } else {
        fetchClosers();
      }
    }
  }, [isAdmin, isLeader]);

  useEffect(() => {
    if (leaderSquad) {
      fetchClosers();
    }
  }, [leaderSquad]);

  const fetchLeaderSquad = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('squad_members')
        .select('squad_id, squads(id, name)')
        .eq('user_id', user.id)
        .single();

      if (error) throw error;

      if (data && data.squads) {
        const squad = data.squads as unknown as LeaderSquad;
        setLeaderSquad({ id: squad.id, name: squad.name });
      }
    } catch (error) {
      console.error('Error fetching leader squad:', error);
      setLoading(false);
    }
  };

  const fetchClosers = async () => {
    try {
      let profilesData;

      if (isAdmin) {
        // Admin vê todos os closers
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) throw error;
        profilesData = data;
      } else if (isLeader && leaderSquad) {
        // Líder vê apenas membros do seu squad
        const { data: squadMembers, error: squadError } = await supabase
          .from('squad_members')
          .select('user_id')
          .eq('squad_id', leaderSquad.id);

        if (squadError) throw squadError;

        const memberIds = (squadMembers || []).map(m => m.user_id);
        
        if (memberIds.length === 0) {
          setClosers([]);
          setLoading(false);
          return;
        }

        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .in('user_id', memberIds)
          .order('created_at', { ascending: false });

        if (error) throw error;
        profilesData = data;
      } else {
        setLoading(false);
        return;
      }

      // Buscar roles de todos os usuários
      const userIds = (profilesData || []).map(p => p.user_id);
      const { data: rolesData, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role')
        .in('user_id', userIds);

      if (rolesError) throw rolesError;

      // Mapear roles por user_id
      const rolesMap = new Map<string, UserRole>();
      (rolesData || []).forEach(r => {
        rolesMap.set(r.user_id, r.role as UserRole);
      });

      // Combinar perfis com roles
      const closersWithRoles = (profilesData || []).map(c => ({
        ...c,
        closer_level: c.closer_level || 'assessor',
        role: rolesMap.get(c.user_id) || 'closer' as UserRole
      })) as CloserWithProfile[];

      setClosers(closersWithRoles);
    } catch (error) {
      console.error('Error fetching closers:', error);
      toast.error('Erro ao carregar closers');
    } finally {
      setLoading(false);
    }
  };

  const updateCloserLevel = async (closerId: string, newLevel: CloserLevel) => {
    const closer = closers.find(c => c.id === closerId);
    const oldLevel = closer?.closer_level;

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ closer_level: newLevel })
        .eq('id', closerId);

      if (error) throw error;
      
      // Log audit
      await logAction({
        actionType: 'level_changed',
        entityType: 'closer_level',
        targetUserId: closer?.user_id,
        entityId: closerId,
        oldValue: { closer_level: oldLevel },
        newValue: { closer_level: newLevel },
        metadata: { closer_name: closer?.full_name },
      });

      setClosers(prev => prev.map(c => 
        c.id === closerId ? { ...c, closer_level: newLevel } : c
      ));
      toast.success('Nível atualizado com sucesso');
    } catch (error) {
      console.error('Error updating closer level:', error);
      toast.error('Erro ao atualizar nível');
    }
  };

  const toggleCloserStatus = async (closerId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
    const closer = closers.find(c => c.id === closerId);
    
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ status: newStatus })
        .eq('id', closerId);

      if (error) throw error;
      
      // Log audit
      await logAction({
        actionType: 'status_changed',
        entityType: 'closer_status',
        targetUserId: closer?.user_id,
        entityId: closerId,
        oldValue: { status: currentStatus },
        newValue: { status: newStatus },
        metadata: { closer_name: closer?.full_name },
      });

      setClosers(prev => prev.map(c => 
        c.id === closerId ? { ...c, status: newStatus } : c
      ));
      toast.success(`Closer ${newStatus === 'active' ? 'ativado' : 'desativado'}`);
    } catch (error) {
      console.error('Error updating closer status:', error);
      toast.error('Erro ao atualizar status');
    }
  };

  if (roleLoading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </MainLayout>
    );
  }

  if (!isAdmin && !isLeader) {
    return <Navigate to="/" replace />;
  }

  const isLeaderOnly = isLeader && !isAdmin;

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-display font-bold flex items-center gap-2">
            <Shield className="w-8 h-8 text-primary" />
            {isLeaderOnly ? 'Painel do Time' : 'Administração'}
          </h1>
          <p className="text-muted-foreground mt-1">
            {isLeaderOnly 
              ? `Gerencie os membros do time ${leaderSquad?.name || ''}`
              : 'Gerencie closers e times do sistema'
            }
          </p>
        </div>

        <Tabs defaultValue="closers" className="space-y-6">
          <TabsList>
            <TabsTrigger value="closers" className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              {isLeaderOnly ? 'Meu Time' : 'Closers'}
            </TabsTrigger>
            {isAdmin && (
              <TabsTrigger value="squads" className="flex items-center gap-2">
                <Users2 className="w-4 h-4" />
                Times
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="closers" className="space-y-6">
            {/* Stats */}
            <div className="grid gap-4 md:grid-cols-3">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    {isLeaderOnly ? 'Membros do Time' : 'Total de Closers'}
                  </CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{closers.length}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Closers Ativos</CardTitle>
                  <CheckCircle className="h-4 w-4 text-success" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {closers.filter(c => c.status === 'active').length}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Google Conectado</CardTitle>
                  <CheckCircle className="h-4 w-4 text-primary" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {closers.filter(c => c.google_connected).length}
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <div>
                    <CardTitle className="font-display">
                      {isLeaderOnly ? 'Membros do Time' : 'Closers Cadastrados'}
                    </CardTitle>
                    <CardDescription>
                      {isLeaderOnly 
                        ? `Lista de closers do time ${leaderSquad?.name || ''}`
                        : 'Lista de todos os closers registrados no sistema'
                      }
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      onClick={() => setGoalDialogOpen(true)} 
                      variant="outline"
                    >
                      <Target className="w-4 h-4 mr-2" />
                      Definir Meta
                    </Button>
                    {isLeaderOnly && leaderSquad && (
                      <Button 
                        onClick={() => setSquadMembersDialogOpen(true)} 
                        variant="outline"
                      >
                        <Users2 className="w-4 h-4 mr-2" />
                        Gerenciar Time
                      </Button>
                    )}
                    <Button onClick={() => setDialogOpen(true)} className="gradient-primary">
                      <UserPlus className="w-4 h-4 mr-2" />
                      Novo Closer
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  </div>
                ) : closers.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    {isLeaderOnly ? 'Nenhum membro no time ainda' : 'Nenhum closer cadastrado ainda'}
                  </div>
                ) : (
                  <div className="space-y-4">
                    {closers.map((closer) => (
                      <div
                        key={closer.id}
                        className="flex items-center justify-between p-4 rounded-lg border bg-card hover:shadow-md transition-shadow"
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                            <Users className="w-6 h-6 text-primary" />
                          </div>
                          <div>
                            <h3 className="font-semibold">{closer.full_name}</h3>
                            <div className="flex items-center gap-4 text-sm text-muted-foreground">
                              {closer.phone && (
                                <span className="flex items-center gap-1">
                                  <Phone className="w-3 h-3" />
                                  {closer.phone}
                                </span>
                              )}
                              {closer.google_email && (
                                <span className="flex items-center gap-1">
                                  <Mail className="w-3 h-3" />
                                  {closer.google_email}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 flex-wrap">
                          {isAdmin && (
                            <UserRoleSelect
                              userId={closer.user_id}
                              currentRole={closer.role}
                              onRoleChange={(newRole) => {
                                setClosers(prev => prev.map(c => 
                                  c.id === closer.id ? { ...c, role: newRole } : c
                                ));
                              }}
                            />
                          )}
                          <CloserLevelSelect
                            value={closer.closer_level}
                            onValueChange={(newLevel) => updateCloserLevel(closer.id, newLevel)}
                          />
                          {closer.google_connected ? (
                            <Badge variant="default" className="bg-success">
                              <CheckCircle className="w-3 h-3 mr-1" />
                              Google Conectado
                            </Badge>
                          ) : (
                            <Badge variant="secondary">
                              <XCircle className="w-3 h-3 mr-1" />
                              Google Pendente
                            </Badge>
                          )}
                          <Badge 
                            variant={closer.status === 'active' ? 'default' : 'secondary'}
                          >
                            {closer.status === 'active' ? 'Ativo' : 'Inativo'}
                          </Badge>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedCloserForReset({ user_id: closer.user_id, full_name: closer.full_name });
                              setResetPasswordDialogOpen(true);
                            }}
                          >
                            <Key className="w-4 h-4 mr-1" />
                            Senha
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => toggleCloserStatus(closer.id, closer.status)}
                          >
                            {closer.status === 'active' ? 'Desativar' : 'Ativar'}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {isAdmin && (
            <TabsContent value="squads">
              <SquadManagement />
            </TabsContent>
          )}
        </Tabs>
      </div>

      <NewCloserDialog 
        open={dialogOpen} 
        onOpenChange={setDialogOpen}
        onSuccess={() => {
          fetchClosers();
          setDialogOpen(false);
        }}
        leaderSquadId={isLeaderOnly ? leaderSquad?.id : undefined}
      />

      <SetMonthlyGoalDialog
        open={goalDialogOpen}
        onOpenChange={setGoalDialogOpen}
        onSuccess={() => {
          setGoalDialogOpen(false);
        }}
        closers={closers}
      />

      <ResetPasswordDialog
        open={resetPasswordDialogOpen}
        onOpenChange={setResetPasswordDialogOpen}
        closer={selectedCloserForReset}
      />

      {isLeaderOnly && leaderSquad && (
        <SquadMembersDialog
          open={squadMembersDialogOpen}
          onOpenChange={setSquadMembersDialogOpen}
          squad={leaderSquad}
          onMembersChange={fetchClosers}
        />
      )}
    </MainLayout>
  );
}
