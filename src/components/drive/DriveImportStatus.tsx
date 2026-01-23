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
  RotateCcw,
  AlertTriangle,
  Download
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { ImportedFile, ImportStatus } from '@/types';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

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

// Data mínima fixa para importações
const MIN_IMPORT_DATE = '2026-01-01T00:00:00.000Z';

export default function DriveImportStatus({ onImportComplete }: DriveImportStatusProps) {
  const { user } = useAuth();
  const [imports, setImports] = useState<ImportedFile[]>([]);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [autoSyncEnabled, setAutoSyncEnabled] = useState(false);
  const [importFrequency, setImportFrequency] = useState<string | null>(null);
  const [reimportingFile, setReimportingFile] = useState<string | null>(null);
  const [reprocessingAll, setReprocessingAll] = useState(false);
  const [fullImporting, setFullImporting] = useState(false);
  const [processing, setProcessing] = useState(false);
  // Real counts from DB (not limited to last 20)
  const [totalCounts, setTotalCounts] = useState({ completed: 0, pending: 0, errors: 0 });
  // Live processing session
  const [liveSession, setLiveSession] = useState<{
    status: string;
    processedFiles: number;
    totalFiles: number;
    successCount: number;
    errorCount: number;
    currentFileName: string | null;
  } | null>(null);

  useEffect(() => {
    if (user) {
      fetchImportStatus();
      fetchTotalCounts();
      checkAutoSyncSettings();
    }
  }, [user]);

  // Subscribe to realtime updates for user's import session
  useEffect(() => {
    if (!user || !processing) {
      setLiveSession(null);
      return;
    }
    
    const channel = supabase
      .channel('my-import-session')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_import_sessions',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          const data = payload.new as Record<string, unknown>;
          
          if (data) {
            setLiveSession({
              status: data.status as string,
              processedFiles: data.processed_files as number,
              totalFiles: data.total_files as number,
              successCount: data.success_count as number,
              errorCount: data.error_count as number,
              currentFileName: data.current_file_name as string | null,
            });

            if (data.status === 'completed' || data.status === 'error') {
              setTimeout(() => {
                setProcessing(false);
                setLiveSession(null);
                fetchImportStatus();
                fetchTotalCounts();
                if (data.status === 'completed') {
                  onImportComplete?.();
                }
              }, 1000);
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, processing, onImportComplete]);

  // Fetch real counts for all files (not limited to last 20)
  const fetchTotalCounts = async () => {
    if (!user) return;
    
    try {
      const { data: allFiles } = await supabase
        .from('imported_files')
        .select('status')
        .eq('user_id', user.id);
      
      if (allFiles) {
        const completed = allFiles.filter(f => f.status === 'completed').length;
        const pending = allFiles.filter(f => f.status === 'pending' || f.status === 'processing').length;
        const errors = allFiles.filter(f => f.status === 'error').length;
        
        setTotalCounts({ completed, pending, errors });
      }
    } catch (error) {
      console.error('Error fetching total counts:', error);
    }
  };

  const checkAutoSyncSettings = async () => {
    if (!user) return;
    
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('google_connected, drive_auto_import, drive_import_frequency')
        .eq('user_id', user.id)
        .single();
      
      setAutoSyncEnabled(!!profile?.google_connected && !!profile?.drive_auto_import);
      setImportFrequency(profile?.drive_import_frequency || null);
    } catch (error) {
      console.error('Error checking auto-sync settings:', error);
    }
  };

  const fetchImportStatus = async () => {
    if (!user) return;

    try {
      const { data: importsData, error: importsError } = await supabase
        .from('imported_files')
        .select('*')
        .eq('user_id', user.id)
        .order('imported_at', { ascending: false })
        .limit(20);

      if (importsError) throw importsError;
      setImports((importsData || []) as ImportedFile[]);

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

  // Etapa 1: Buscar arquivos do Drive (rápido, só cria pending)
  const handleFullImport = async () => {
    if (!user || fullImporting) return;

    setFullImporting(true);
    try {
      toast.info('Buscando transcrições do Drive...');
      
      // 1. Resetar drive_last_sync para 01/01/2026
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ drive_last_sync: MIN_IMPORT_DATE })
        .eq('user_id', user.id);

      if (updateError) {
        console.error('Error resetting drive_last_sync:', updateError);
        throw new Error('Falha ao resetar data de sincronização');
      }

      // 2. Chamar initial-import (apenas busca e cria pending - rápido!)
      const response = await supabase.functions.invoke('initial-import', {
        body: { userId: user.id },
      });

      if (response.error) {
        throw new Error(response.error.message || 'Failed to import');
      }

      const data = response.data;
      
      if (data.queued > 0) {
        toast.success(`${data.queued} arquivos encontrados! Clique em "Processar" para analisar com IA.`);
      } else {
        toast.info('Nenhum arquivo novo encontrado');
      }

      fetchImportStatus();
    } catch (error) {
      console.error('Error on full import:', error);
      toast.error('Erro ao buscar arquivos');
    } finally {
      setFullImporting(false);
    }
  };

  // Etapa 2: Processar arquivos pendentes (análise com IA) - Usa nova função individual
  const handleProcessPending = async () => {
    if (!user || processing) return;

    if (totalCounts.pending === 0) {
      toast.info('Nenhum arquivo pendente para processar');
      return;
    }

    setProcessing(true);
    try {
      toast.info(`Processando ${totalCounts.pending} arquivos com IA...`);
      
      // Use new individual user processing function
      const response = await supabase.functions.invoke('process-user-files', {
        body: { 
          userId: user.id,
          maxFiles: 100,
          fileDelayMs: 500, // Reduced delay for faster processing (rate limit handled in processFile)
          resetErrors: true
        },
      });

      // Older backend versions could return 409 when a session is already running.
      // Treat that as an expected state so realtime tracking can continue.
      if (response.error) {
        const msg = response.error.message || '';
        if (msg.includes('409') || msg.toLowerCase().includes('already') || msg.toLowerCase().includes('andamento')) {
          toast.info('Processamento já está em andamento. Acompanhe o progresso abaixo.');
          return; // keep `processing=true` for realtime subscription
        }

        throw new Error(response.error.message || 'Failed to process');
      }

      const data = response.data;
      
      if ((data as any)?.alreadyRunning) {
        toast.info('Processamento já está em andamento. Acompanhe o progresso abaixo.');
        // keep `processing=true` for realtime subscription
      } else if (data.sessionId) {
        toast.success('Processamento iniciado! Acompanhe o progresso abaixo.');
        // Processing state will be cleared by realtime subscription when complete
      } else if (data.pendingFiles === 0) {
        toast.info('Nenhum arquivo pendente para processar');
        setProcessing(false);
      }
    } catch (error) {
      console.error('Error processing files:', error);
      toast.error('Erro ao processar arquivos');
      setProcessing(false);
    }
  };

  // Sincronizar: busca apenas novos arquivos desde última sync
  const handleSync = async () => {
    if (!user || syncing) return;

    setSyncing(true);
    try {
      // Usa initial-import que busca arquivos novos rapidamente
      const response = await supabase.functions.invoke('initial-import', {
        body: { userId: user.id },
      });

      if (response.error) {
        throw new Error(response.error.message || 'Failed to sync');
      }

      const data = response.data;
      
      if (data.queued > 0) {
        toast.success(`${data.queued} novos arquivos encontrados! Clique em "Processar" para analisar.`);
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

  const handleReprocessAll = async () => {
    if (!user || reprocessingAll) return;

    const totalPending = totalCounts.pending + totalCounts.errors;
    if (totalPending === 0) {
      toast.info('Nenhum arquivo para reprocessar');
      return;
    }

    setReprocessingAll(true);
    toast.info(`Iniciando reprocessamento de ${totalPending} arquivos...`);

    try {
      // Use new individual user processing function with resetErrors
      const response = await supabase.functions.invoke('process-user-files', {
        body: { 
          userId: user.id,
          maxFiles: 100,
          fileDelayMs: 500, // Reduced delay for faster processing (rate limit handled in processFile)
          resetErrors: true
        },
      });

      if (response.error) {
        const msg = response.error.message || '';
        if (msg.includes('409') || msg.toLowerCase().includes('already') || msg.toLowerCase().includes('andamento')) {
          toast.info('Reprocessamento já está em andamento. Acompanhe o progresso.');
          setProcessing(true);
          return;
        }

        throw new Error(response.error.message || 'Failed to process');
      }

      const data = response.data;
      
      if ((data as any)?.alreadyRunning) {
        toast.info('Reprocessamento já está em andamento. Acompanhe o progresso.');
        setProcessing(true);
      } else if (data.sessionId) {
        toast.success('Reprocessamento iniciado! Acompanhe o progresso.');
        setProcessing(true); // Enable realtime tracking
        onImportComplete?.();
      }
    } catch (error) {
      console.error('Error reprocessing files:', error);
      toast.error('Erro ao iniciar reprocessamento');
    } finally {
      setReprocessingAll(false);
      fetchImportStatus();
      fetchTotalCounts();
    }
  };

  // Use real counts from totalCounts (accurate), not limited imports list
  const completedCount = totalCounts.completed;
  const errorCount = totalCounts.errors;
  const pendingCount = totalCounts.pending;

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
    <TooltipProvider>
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Status de Importação
            </CardTitle>
            <div className="flex gap-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={handleFullImport}
                    disabled={syncing || reprocessingAll || fullImporting || processing}
                  >
                    {fullImporting ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Download className="w-4 h-4 mr-2" />
                    )}
                    Buscar
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-xs">
                  <p className="text-xs">
                    Etapa 1: Busca transcrições do Drive (rápido).
                    Arquivos ficam pendentes para processamento.
                  </p>
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="default" 
                    size="sm" 
                    onClick={handleProcessPending}
                    disabled={syncing || reprocessingAll || fullImporting || processing || pendingCount === 0}
                    className="bg-gradient-to-r from-primary to-primary/80"
                  >
                    {processing ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <RefreshCw className="w-4 h-4 mr-2" />
                    )}
                    Processar ({pendingCount})
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-xs">
                  <p className="text-xs">
                    Etapa 2: Analisa arquivos pendentes com IA.
                    Pode demorar ~5s por arquivo.
                  </p>
                </TooltipContent>
              </Tooltip>
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

          {/* Reprocess all button */}
          {(errorCount > 0 || pendingCount > 0) && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleReprocessAll}
              disabled={syncing || reprocessingAll}
              className="w-full"
            >
              {reprocessingAll ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <RotateCcw className="w-4 h-4 mr-2" />
              )}
              Reprocessar {errorCount + pendingCount} pendências
            </Button>
          )}

          {/* Last sync and auto-sync status */}
          <div className="text-sm text-muted-foreground text-center space-y-1">
            {lastSync && (
              <div>
                Última sincronização: {format(new Date(lastSync), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
              </div>
            )}
            {autoSyncEnabled && importFrequency && (
              <div className="flex items-center justify-center gap-2 text-xs">
                <Badge variant="secondary" className="bg-success/10 text-success border-success/20">
                  <Clock className="w-3 h-3 mr-1" />
                  Sync automático: {importFrequency === 'hourly' ? 'A cada hora' : importFrequency === 'daily' ? 'Diário' : importFrequency}
                </Badge>
              </div>
            )}
          </div>

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
                        {file.status === 'error' && file.error_message && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <AlertTriangle className="w-4 h-4 text-destructive shrink-0 cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent side="top" className="max-w-xs">
                              <p className="text-xs">{file.error_message}</p>
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {(file.status === 'error' || file.status === 'processing') && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleReimport(file)}
                            disabled={isReimporting || syncing || reprocessingAll}
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
    </TooltipProvider>
  );
}