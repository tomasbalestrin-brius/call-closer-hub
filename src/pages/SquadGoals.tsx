import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import MainLayout from '@/components/layout/MainLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Target, 
  Users, 
  Loader2,
  Calendar,
  TrendingUp
} from 'lucide-react';
import { toast } from 'sonner';
import { SetMonthlyGoalDialog } from '@/components/admin/SetMonthlyGoalDialog';
import { Navigate } from 'react-router-dom';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface SquadMember {
  id: string;
  user_id: string;
  full_name: string;
  closer_level: string;
  status: string;
}

interface MonthlyGoal {
  id: string;
  closer_id: string;
  month: number;
  year: number;
  goal_value: number;
}

export default function SquadGoals() {
  const { user } = useAuth();
  const { isLeader, isAdmin, loading: roleLoading } = useUserRole();
  const [squadMembers, setSquadMembers] = useState<SquadMember[]>([]);
  const [goals, setGoals] = useState<MonthlyGoal[]>([]);
  const [loading, setLoading] = useState(true);
  const [goalDialogOpen, setGoalDialogOpen] = useState(false);
  const [squadName, setSquadName] = useState<string>('');

  const currentMonth = new Date().getMonth() + 1;
  const currentYear = new Date().getFullYear();

  useEffect(() => {
    if ((isLeader || isAdmin) && user) {
      fetchSquadData();
    }
  }, [isLeader, isAdmin, user]);

  const fetchSquadData = async () => {
    if (!user) return;
    
    try {
      // Buscar o squad do líder
      const { data: memberData, error: memberError } = await supabase
        .from('squad_members')
        .select('squad_id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (memberError) throw memberError;
      
      if (!memberData) {
        setLoading(false);
        return;
      }

      // Buscar nome do squad
      const { data: squadData, error: squadError } = await supabase
        .from('squads')
        .select('name')
        .eq('id', memberData.squad_id)
        .single();

      if (squadError) throw squadError;
      setSquadName(squadData?.name || '');

      // Buscar membros do squad
      const { data: squadMembersData, error: squadMembersError } = await supabase
        .from('squad_members')
        .select('user_id')
        .eq('squad_id', memberData.squad_id);

      if (squadMembersError) throw squadMembersError;

      const memberUserIds = squadMembersData?.map(m => m.user_id) || [];

      // Buscar perfis dos membros
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, user_id, full_name, closer_level, status')
        .in('user_id', memberUserIds);

      if (profilesError) throw profilesError;

      // Filtrar para remover o próprio líder da lista
      const members = (profilesData || []).filter(p => p.user_id !== user.id) as SquadMember[];
      setSquadMembers(members);

      // Buscar metas do mês atual para os membros
      const { data: goalsData, error: goalsError } = await supabase
        .from('monthly_goals')
        .select('*')
        .in('closer_id', memberUserIds)
        .eq('month', currentMonth)
        .eq('year', currentYear);

      if (goalsError) throw goalsError;
      setGoals(goalsData || []);

    } catch (error) {
      console.error('Error fetching squad data:', error);
      toast.error('Erro ao carregar dados do squad');
    } finally {
      setLoading(false);
    }
  };

  const getGoalForMember = (userId: string) => {
    return goals.find(g => g.closer_id === userId);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
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

  if (!isLeader && !isAdmin) {
    return <Navigate to="/" replace />;
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-display font-bold flex items-center gap-2">
            <Target className="w-8 h-8 text-primary" />
            Metas do Squad
          </h1>
          <p className="text-muted-foreground mt-1">
            {squadName ? `Gerencie as metas mensais do ${squadName}` : 'Gerencie as metas mensais do seu squad'}
          </p>
        </div>

        {/* Current Month Info */}
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="flex items-center justify-between py-4">
            <div className="flex items-center gap-3">
              <Calendar className="w-5 h-5 text-primary" />
              <span className="font-medium">
                Período atual: {format(new Date(), 'MMMM yyyy', { locale: ptBR })}
              </span>
            </div>
            <Button onClick={() => setGoalDialogOpen(true)} className="gradient-primary">
              <Target className="w-4 h-4 mr-2" />
              Definir Meta
            </Button>
          </CardContent>
        </Card>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Membros do Squad</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{squadMembers.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Metas Definidas</CardTitle>
              <Target className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {goals.length} / {squadMembers.length}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total em Metas</CardTitle>
              <TrendingUp className="h-4 w-4 text-success" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatCurrency(goals.reduce((sum, g) => sum + Number(g.goal_value), 0))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Members List */}
        <Card>
          <CardHeader>
            <CardTitle className="font-display">Closers do Squad</CardTitle>
            <CardDescription>
              Visualize e gerencie as metas de cada membro
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : squadMembers.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Nenhum membro no squad ou você não está associado a um squad
              </div>
            ) : (
              <div className="space-y-4">
                {squadMembers.map((member) => {
                  const goal = getGoalForMember(member.user_id);
                  return (
                    <div
                      key={member.id}
                      className="flex items-center justify-between p-4 rounded-lg border bg-card hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                          <Users className="w-6 h-6 text-primary" />
                        </div>
                        <div>
                          <h3 className="font-semibold">{member.full_name}</h3>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Badge variant="outline" className="text-xs">
                              {member.closer_level}
                            </Badge>
                            <Badge 
                              variant={member.status === 'active' ? 'default' : 'secondary'}
                              className="text-xs"
                            >
                              {member.status === 'active' ? 'Ativo' : 'Inativo'}
                            </Badge>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        {goal ? (
                          <div className="text-right">
                            <div className="text-sm text-muted-foreground">Meta do mês</div>
                            <div className="font-bold text-lg text-primary">
                              {formatCurrency(goal.goal_value)}
                            </div>
                          </div>
                        ) : (
                          <div className="text-right">
                            <div className="text-sm text-muted-foreground">Meta do mês</div>
                            <div className="text-sm text-warning">Não definida</div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <SetMonthlyGoalDialog
        open={goalDialogOpen}
        onOpenChange={setGoalDialogOpen}
        onSuccess={() => {
          setGoalDialogOpen(false);
          fetchSquadData();
        }}
        closers={squadMembers}
      />
    </MainLayout>
  );
}
