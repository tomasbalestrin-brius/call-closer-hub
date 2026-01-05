import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import MainLayout from '@/components/layout/MainLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Users, 
  UserPlus, 
  Shield, 
  Mail, 
  Phone,
  CheckCircle,
  XCircle,
  Loader2
} from 'lucide-react';
import { toast } from 'sonner';
import { NewCloserDialog } from '@/components/admin/NewCloserDialog';
import { Navigate } from 'react-router-dom';

interface CloserWithProfile {
  id: string;
  user_id: string;
  full_name: string;
  phone: string | null;
  google_connected: boolean;
  google_email: string | null;
  status: string;
  created_at: string;
}

export default function Admin() {
  const { user } = useAuth();
  const { isAdmin, loading: roleLoading } = useUserRole();
  const [closers, setClosers] = useState<CloserWithProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    if (isAdmin) {
      fetchClosers();
    }
  }, [isAdmin]);

  const fetchClosers = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setClosers(data as CloserWithProfile[]);
    } catch (error) {
      console.error('Error fetching closers:', error);
      toast.error('Erro ao carregar closers');
    } finally {
      setLoading(false);
    }
  };

  const toggleCloserStatus = async (closerId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
    
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ status: newStatus })
        .eq('id', closerId);

      if (error) throw error;
      
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

  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-display font-bold flex items-center gap-2">
              <Shield className="w-8 h-8 text-primary" />
              Administração
            </h1>
            <p className="text-muted-foreground mt-1">Gerencie os closers do sistema</p>
          </div>
          <Button onClick={() => setDialogOpen(true)} className="gradient-primary">
            <UserPlus className="w-4 h-4 mr-2" />
            Novo Closer
          </Button>
        </div>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total de Closers</CardTitle>
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

        {/* Closers List */}
        <Card>
          <CardHeader>
            <CardTitle className="font-display">Closers Cadastrados</CardTitle>
            <CardDescription>
              Lista de todos os closers registrados no sistema
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : closers.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Nenhum closer cadastrado ainda
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
                    <div className="flex items-center gap-3">
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
      </div>

      <NewCloserDialog 
        open={dialogOpen} 
        onOpenChange={setDialogOpen}
        onSuccess={() => {
          fetchClosers();
          setDialogOpen(false);
        }}
      />
    </MainLayout>
  );
}
