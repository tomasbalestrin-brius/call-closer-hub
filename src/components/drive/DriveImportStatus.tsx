import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  RefreshCw, 
  FileText, 
  CheckCircle, 
  AlertCircle, 
  Clock,
  Loader2,
  RotateCcw
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
  const [autoSyncEnabled, setAutoSyncEnabled] = useState(false);
  const [reimportingFile, setReimportingFile] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      fetchImportStatus();
      checkAutoSyncSettings();
    }
  }, [user]);

  // Auto-sync every 5 minutes when enabled
  useEffect(() => {
    if (!user || !autoSyncEnabled) return;

    const interval = setInterval(() => {
      console.log('Auto-sync triggered...');
      handleSync();
    }, 5 * 60 * 1000); // 5 minutes

    return () => clearInterval(interval);
  }, [user, autoSyncEnabled]);

  const checkAutoSyncSettings = async () => {
    if (!user) return;
    
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('google_connected')
        .eq('user_id', user.id)
        .single();
      
      // Enable auto-sync if Google is connected
      setAutoSyncEnabled(!!profile?.google_connected);
    } catch (error) {
      console.error('Error checking auto-sync settings:', error);
    }
  };

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

  const handleInitialImport = async () => {
    if (!user || syncing) return;

    setSyncing(true);
    try {
      toast.info('Iniciando importação do mês atual...');
      
      const response = await supabase.functions.invoke('initial-import', {
        body: { userId: user.id },
      });

      if (response.error) {
        throw new Error(response.error.message || 'Failed to import');
      }

      const data = response.data;
      
      if (data.imported > 0) {
        toast.success(`${data.imported} arquivos importados e analisados!`);
        onImportComplete?.();
      } else if (data.total === 0) {
        toast.info('Nenhum arquivo encontrado no mês atual');
      } else {
        toast.info('Nenhum arquivo novo para importar');
      }

      if (data.errors > 0) {
        toast.warning(`${data.errors} arquivos falharam na importação`);
      }

      fetchImportStatus();
    } catch (error) {
      console.error('Error on initial import:', error);
      toast.error('Erro na importação inicial');
    } finally {
      setSyncing(false);
    }
  };

  const handleReimport = async (file: ImportedFile) => {
    if (!user || reimportingFile) return;

    setReimportingFile(file.id);
    try {
      // Delete the error record first
      await supabase
        .from('imported_files')
        .delete()
        .eq('id', file.id);

      // Re-import the file
      const response = await supabase.functions.invoke('import-and-analyze', {
        body: { 
          userId: user.id, 
          fileId: file.drive_file_id,
          fileName: file.file_name
        },
      });

      if (response.error) {
        throw new Error(response.error.message || 'Failed to reimport');
      }

      toast.success(`${file.file_name} reimportado com sucesso!`);
      onImportComplete?.();
      fetchImportStatus();
    } catch (error) {
      console.error('Error reimporting file:', error);
      toast.error('Erro ao reimportar arquivo');
      fetchImportStatus();
    } finally {
      setReimportingFile(null);
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
          <div className="flex gap-2">
            <Button 
              variant="default" 
              size="sm" 
              onClick={handleInitialImport}
              disabled={syncing}
            >
              {syncing ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <FileText className="w-4 h-4 mr-2" />
              )}
              Importar Mês
            </Button>
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
                const isReimporting = reimportingFile === file.id;
                return (
                  <div 
                    key={file.id} 
                    className="flex items-center justify-between p-2 rounded-lg bg-secondary/30 gap-2"
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      {config.icon}
                      <span className="text-sm truncate">{file.file_name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {file.status === 'error' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleReimport(file)}
                          disabled={isReimporting || syncing}
                          className="h-7 px-2"
                        >
                          {isReimporting ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <RotateCcw className="w-3 h-3" />
                          )}
                          <span className="ml-1 text-xs">Reimportar</span>
                        </Button>
                      )}
                      <Badge className={config.className}>
                        {config.label}
                      </Badge>
                    </div>
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
