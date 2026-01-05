import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  RefreshCw, 
  FileText, 
  CheckCircle, 
  AlertCircle, 
  Clock,
  Loader2
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { ImportedFile, ImportStatus } from '@/types';

interface DriveImportStatusProps {
  onImportComplete?: () => void;
}

const statusConfig: Record<ImportStatus, { label: string; icon: React.ReactNode; className: string }> = {
  pending: { 
    label: 'Pendente', 
    icon: <Clock className="w-4 h-4" />, 
    className: 'bg-secondary text-secondary-foreground' 
  },
  processing: { 
    label: 'Processando', 
    icon: <Loader2 className="w-4 h-4 animate-spin" />, 
    className: 'bg-info text-info-foreground' 
  },
  completed: { 
    label: 'Concluído', 
    icon: <CheckCircle className="w-4 h-4" />, 
    className: 'bg-success text-success-foreground' 
  },
  error: { 
    label: 'Erro', 
    icon: <AlertCircle className="w-4 h-4" />, 
    className: 'bg-destructive text-destructive-foreground' 
  },
};

export default function DriveImportStatus({ onImportComplete }: DriveImportStatusProps) {
  const { user } = useAuth();
  const [imports, setImports] = useState<ImportedFile[]>([]);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchImportStatus();
    }
  }, [user]);

  const fetchImportStatus = async () => {
    if (!user) return;

    try {
      // Fetch recent imports
      const { data: importsData, error: importsError } = await supabase
        .from('imported_files')
        .select('*')
        .eq('user_id', user.id)
        .order('imported_at', { ascending: false })
        .limit(10);

      if (importsError) throw importsError;
      setImports((importsData || []) as ImportedFile[]);

      // Fetch last sync time from profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('drive_last_sync')
        .eq('user_id', user.id)
        .single();

      if (profile?.drive_last_sync) {
        setLastSync(profile.drive_last_sync);
      }
    } catch (error) {
      console.error('Error fetching import status:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    if (!user || syncing) return;

    setSyncing(true);
    try {
      const response = await supabase.functions.invoke('sync-drive-files', {
        body: { userId: user.id },
      });

      if (response.error) {
        throw new Error(response.error.message || 'Failed to sync');
      }

      const data = response.data;
      
      if (data.synced > 0) {
        toast.success(`${data.synced} arquivos sincronizados e analisados!`);
        onImportComplete?.();
      } else {
        toast.info('Nenhum arquivo novo para importar');
      }

      fetchImportStatus();
    } catch (error) {
      console.error('Error syncing:', error);
      toast.error('Erro ao sincronizar arquivos');
    } finally {
      setSyncing(false);
    }
  };

  const completedCount = imports.filter(i => i.status === 'completed').length;
  const errorCount = imports.filter(i => i.status === 'error').length;
  const pendingCount = imports.filter(i => i.status === 'pending' || i.status === 'processing').length;

  if (loading) {
    return (
      <Card>
        <CardContent className="py-6 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Status de Importação
          </CardTitle>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleSync}
            disabled={syncing}
          >
            {syncing ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4 mr-2" />
            )}
            Sincronizar
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary */}
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="p-2 rounded-lg bg-success/10">
            <div className="text-2xl font-bold text-success">{completedCount}</div>
            <div className="text-xs text-muted-foreground">Importados</div>
          </div>
          <div className="p-2 rounded-lg bg-warning/10">
            <div className="text-2xl font-bold text-warning">{pendingCount}</div>
            <div className="text-xs text-muted-foreground">Pendentes</div>
          </div>
          <div className="p-2 rounded-lg bg-destructive/10">
            <div className="text-2xl font-bold text-destructive">{errorCount}</div>
            <div className="text-xs text-muted-foreground">Erros</div>
          </div>
        </div>

        {/* Last sync */}
        {lastSync && (
          <div className="text-sm text-muted-foreground text-center">
            Última sincronização: {format(new Date(lastSync), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
          </div>
        )}

        {/* Recent imports */}
        {imports.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Arquivos recentes</h4>
            <div className="max-h-[200px] overflow-y-auto space-y-2">
              {imports.map((file) => {
                const config = statusConfig[file.status];
                return (
                  <div 
                    key={file.id} 
                    className="flex items-center justify-between p-2 rounded-lg bg-secondary/30"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {config.icon}
                      <span className="text-sm truncate">{file.file_name}</span>
                    </div>
                    <Badge className={config.className}>
                      {config.label}
                    </Badge>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {imports.length === 0 && (
          <div className="text-center py-4 text-muted-foreground text-sm">
            Nenhum arquivo importado ainda
          </div>
        )}
      </CardContent>
    </Card>
  );
}
