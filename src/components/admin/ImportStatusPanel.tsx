import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { 
  RefreshCw, 
  Play, 
  FileText, 
  CheckCircle, 
  AlertCircle, 
  Clock, 
  Users,
  Zap,
  Rocket,
  RotateCcw,
  Loader2,
  StopCircle
} from "lucide-react";

interface CloserImportStatus {
  id: string;
  fullName: string;
  googleConnected: boolean;
  pendingImports: number;
  completedImports: number;
  errorImports: number;
  processingImports: number;
  totalCalls: number;
  userId: string;
}

interface ImportSummary {
  totalPending: number;
  totalCompleted: number;
  totalErrors: number;
  totalProcessing: number;
  closersWithGoogle: number;
  closersWithPending: number;
}

interface UserSession {
  id: string;
  user_id: string;
  session_id: string;
  status: string;
  total_files: number | null;
  processed_files: number | null;
  success_count: number | null;
  error_count: number | null;
  current_file_name: string | null;
  started_at: string | null;
  completed_at: string | null;
}

export function ImportStatusPanel() {
  const [closerStatuses, setCloserStatuses] = useState<CloserImportStatus[]>([]);
  const [summary, setSummary] = useState<ImportSummary>({
    totalPending: 0,
    totalCompleted: 0,
    totalErrors: 0,
    totalProcessing: 0,
    closersWithGoogle: 0,
    closersWithPending: 0
  });
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [closerSessions, setCloserSessions] = useState<Map<string, UserSession>>(new Map());
  const [lastProcessResult, setLastProcessResult] = useState<{success: number, errors: number} | null>(null);

  const fetchImportStatuses = useCallback(async () => {
    try {
      // Get all profiles with Google connection status
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, user_id, full_name, google_connected')
        .order('full_name');

      if (profilesError) throw profilesError;

      // Get all imported files counts grouped by user
      const { data: importedFiles, error: filesError } = await supabase
        .from('imported_files')
        .select('user_id, status');

      if (filesError) throw filesError;

      // Get calls count per closer
      const { data: calls, error: callsError } = await supabase
        .from('calls')
        .select('closer_id');

      if (callsError) throw callsError;

      // Aggregate data
      const filesByUser = new Map<string, { pending: number; completed: number; error: number; processing: number }>();
      importedFiles?.forEach(file => {
        const current = filesByUser.get(file.user_id) || { pending: 0, completed: 0, error: 0, processing: 0 };
        if (file.status === 'pending') current.pending++;
        else if (file.status === 'completed') current.completed++;
        else if (file.status === 'error') current.error++;
        else if (file.status === 'processing') current.processing++;
        filesByUser.set(file.user_id, current);
      });

      const callsByCloser = new Map<string, number>();
      calls?.forEach(call => {
        callsByCloser.set(call.closer_id, (callsByCloser.get(call.closer_id) || 0) + 1);
      });

      // Build status array
      const statuses: CloserImportStatus[] = (profiles || []).map(profile => {
        const files = filesByUser.get(profile.user_id) || { pending: 0, completed: 0, error: 0, processing: 0 };
        return {
          id: profile.id,
          fullName: profile.full_name,
          googleConnected: profile.google_connected || false,
          pendingImports: files.pending,
          completedImports: files.completed,
          errorImports: files.error,
          processingImports: files.processing,
          totalCalls: callsByCloser.get(profile.user_id) || 0,
          userId: profile.user_id
        };
      });

      // Calculate summary
      const summaryData: ImportSummary = {
        totalPending: statuses.reduce((sum, s) => sum + s.pendingImports, 0),
        totalCompleted: statuses.reduce((sum, s) => sum + s.completedImports, 0),
        totalErrors: statuses.reduce((sum, s) => sum + s.errorImports, 0),
        totalProcessing: statuses.reduce((sum, s) => sum + s.processingImports, 0),
        closersWithGoogle: statuses.filter(s => s.googleConnected).length,
        closersWithPending: statuses.filter(s => s.pendingImports > 0).length
      };

      setCloserStatuses(statuses);
      setSummary(summaryData);
    } catch (error) {
      console.error('Error fetching import statuses:', error);
      toast.error('Erro ao carregar status de importação');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchImportStatuses();

    // Subscribe to user_import_sessions changes for real-time progress
    const channel = supabase
      .channel('admin-import-sessions')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_import_sessions'
        },
        (payload) => {
          console.log('[Admin] Session update:', payload);
          
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            const session = payload.new as UserSession;
            
            setCloserSessions(prev => {
              const newMap = new Map(prev);
              newMap.set(session.user_id, session);
              return newMap;
            });

            // Check if any session just completed
            if (session.status === 'completed' || session.status === 'error') {
              fetchImportStatuses();
            }
          }
        }
      )
      .subscribe();

    // Also subscribe to imported_files for immediate UI updates
    const filesChannel = supabase
      .channel('admin-imported-files')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'imported_files'
        },
        () => {
          // Debounce refresh
          setTimeout(() => fetchImportStatuses(), 500);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(filesChannel);
    };
  }, [fetchImportStatuses]);

  // Check if any session is still running
  useEffect(() => {
    const hasRunning = Array.from(closerSessions.values()).some(s => s.status === 'running');
    if (!hasRunning && processing) {
      // All sessions completed
      const totalSuccess = Array.from(closerSessions.values()).reduce((sum, s) => sum + (s.success_count || 0), 0);
      const totalErrors = Array.from(closerSessions.values()).reduce((sum, s) => sum + (s.error_count || 0), 0);
      
      if (totalSuccess > 0 || totalErrors > 0) {
        setLastProcessResult({ success: totalSuccess, errors: totalErrors });
        toast.success(`Processamento concluído: ${totalSuccess} sucesso, ${totalErrors} erros`);
      }
      
      setProcessing(false);
    }
  }, [closerSessions, processing]);

  const triggerImportForUser = async (userId: string, userName: string) => {
    try {
      toast.info(`Importando arquivos do Drive para ${userName}...`);
      
      const { data, error } = await supabase.functions.invoke('initial-import', {
        body: { userId }
      });

      if (error) throw error;

      toast.success(`${data?.newFiles || data?.queued || 0} novos arquivos encontrados para ${userName}`);
      await fetchImportStatuses();
    } catch (error) {
      console.error('Error triggering import:', error);
      toast.error(`Erro ao importar para ${userName}`);
    }
  };

  const processUserFiles = async (userId: string, userName: string, pendingCount: number) => {
    try {
      setProcessing(true);
      toast.info(`Iniciando análise de ${pendingCount} arquivos para ${userName}...`);

      const { data, error } = await supabase.functions.invoke('process-user-files', {
        body: { 
          userId, 
          maxFiles: 100,
          fileDelayMs: 2000
        }
      });

      if (error) throw error;

      toast.success(`Processamento iniciado para ${userName}`);
    } catch (error) {
      console.error('Error processing user files:', error);
      toast.error(`Erro ao processar arquivos de ${userName}`);
      setProcessing(false);
    }
  };

  const processBatchParallel = async (maxParallel: number, resetErrors: boolean = false) => {
    const closersWithPending = closerStatuses.filter(c => 
      c.googleConnected && (c.pendingImports > 0 || (resetErrors && c.errorImports > 0))
    );

    if (closersWithPending.length === 0) {
      toast.info('Nenhum closer com arquivos pendentes');
      return;
    }

    // Force reset any stuck processing files before starting
    await supabase
      .from('imported_files')
      .update({ status: 'pending', started_processing_at: null, error_message: null })
      .eq('status', 'processing');

    // Reset any running sessions to idle
    await supabase
      .from('user_import_sessions')
      .update({ status: 'idle', completed_at: new Date().toISOString() })
      .eq('status', 'running');

    // Reset error files if requested
    if (resetErrors) {
      await supabase
        .from('imported_files')
        .update({ status: 'pending', error_message: null })
        .eq('status', 'error');
    }

    setProcessing(true);
    setCloserSessions(new Map());
    setLastProcessResult(null);

    const modeLabel = maxParallel === 1 ? 'Individual' : maxParallel === 3 ? 'Turbo' : 'Ultra';
    toast.info(`Iniciando modo ${modeLabel}: ${closersWithPending.length} closers, ${maxParallel} em paralelo`);

    // Process in batches
    for (let i = 0; i < closersWithPending.length; i += maxParallel) {
      const batch = closersWithPending.slice(i, i + maxParallel);
      
      // Start all closers in this batch in parallel
      await Promise.all(batch.map(async (closer) => {
        try {
          const { error } = await supabase.functions.invoke('process-user-files', {
            body: { 
              userId: closer.userId, 
              maxFiles: 50,
              fileDelayMs: 2500
            }
          });

          if (error) {
            // Handle 409 conflict gracefully
            if (error.message?.includes('409') || error.message?.includes('already')) {
              console.log(`${closer.fullName} já tem processamento ativo, pulando...`);
            } else {
              console.error(`Error starting process for ${closer.fullName}:`, error);
            }
          }
        } catch (error) {
          console.error(`Error starting process for ${closer.fullName}:`, error);
        }
      }));

      // Wait for this batch to complete before starting next (if not the last batch)
      if (i + maxParallel < closersWithPending.length) {
        await waitForBatchCompletion(batch.map(c => c.userId));
      }
    }
  };

  const waitForBatchCompletion = async (userIds: string[]): Promise<void> => {
    return new Promise((resolve) => {
      const checkInterval = setInterval(async () => {
        const { data: sessions } = await supabase
          .from('user_import_sessions')
          .select('user_id, status')
          .in('user_id', userIds)
          .order('created_at', { ascending: false });

        // Get latest session for each user
        const latestByUser = new Map<string, string>();
        sessions?.forEach(s => {
          if (!latestByUser.has(s.user_id)) {
            latestByUser.set(s.user_id, s.status);
          }
        });

        // Check if all are done
        const allDone = userIds.every(userId => {
          const status = latestByUser.get(userId);
          return status === 'completed' || status === 'error' || status === 'idle';
        });

        if (allDone) {
          clearInterval(checkInterval);
          resolve();
        }
      }, 3000);

      // Timeout after 10 minutes
      setTimeout(() => {
        clearInterval(checkInterval);
        resolve();
      }, 600000);
    });
  };

  const resetErrorFiles = async () => {
    try {
      const { error } = await supabase
        .from('imported_files')
        .update({ status: 'pending', error_message: null })
        .eq('status', 'error');

      if (error) throw error;

      toast.success('Arquivos com erro resetados para pendente');
      await fetchImportStatuses();
    } catch (error) {
      console.error('Error resetting error files:', error);
      toast.error('Erro ao resetar arquivos');
    }
  };

  const resetProcessingFiles = async () => {
    try {
      const { error } = await supabase
        .from('imported_files')
        .update({ status: 'pending', started_processing_at: null })
        .eq('status', 'processing');

      if (error) throw error;

      toast.success('Arquivos travados resetados');
      await fetchImportStatuses();
    } catch (error) {
      console.error('Error resetting processing files:', error);
      toast.error('Erro ao resetar arquivos travados');
    }
  };

  const cancelAllProcessing = async () => {
    try {
      // Mark all running sessions as cancelled
      await supabase
        .from('user_import_sessions')
        .update({ status: 'idle', completed_at: new Date().toISOString() })
        .eq('status', 'running');

      // Reset any files stuck in processing
      await supabase
        .from('imported_files')
        .update({ status: 'pending', started_processing_at: null })
        .eq('status', 'processing');

      setProcessing(false);
      setCloserSessions(new Map());
      toast.info('Processamento cancelado');
      await fetchImportStatuses();
    } catch (error) {
      console.error('Error cancelling:', error);
      toast.error('Erro ao cancelar');
    }
  };

  const getSessionForUser = (userId: string): UserSession | undefined => {
    return closerSessions.get(userId);
  };

  const getProgressForUser = (userId: string): number => {
    const session = getSessionForUser(userId);
    if (!session || !session.total_files || session.total_files === 0) return 0;
    return Math.round(((session.processed_files || 0) / session.total_files) * 100);
  };

  const estimateTimeRemaining = (): string => {
    const runningSessions = Array.from(closerSessions.values()).filter(s => s.status === 'running');
    if (runningSessions.length === 0) return '';

    const totalRemaining = runningSessions.reduce((sum, s) => {
      return sum + ((s.total_files || 0) - (s.processed_files || 0));
    }, 0);

    const avgTimePerFile = 15; // seconds
    const totalSeconds = totalRemaining * avgTimePerFile;
    
    if (totalSeconds < 60) return `~${totalSeconds}s`;
    if (totalSeconds < 3600) return `~${Math.ceil(totalSeconds / 60)}min`;
    return `~${Math.ceil(totalSeconds / 3600)}h`;
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
          <p className="mt-2 text-muted-foreground">Carregando status de importação...</p>
        </CardContent>
      </Card>
    );
  }

  const runningSessions = Array.from(closerSessions.values()).filter(s => s.status === 'running');
  const hasActiveProcessing = processing || runningSessions.length > 0;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-yellow-500" />
              <span className="text-sm text-muted-foreground">Pendentes</span>
            </div>
            <p className="text-2xl font-bold">{summary.totalPending}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span className="text-sm text-muted-foreground">Completos</span>
            </div>
            <p className="text-2xl font-bold">{summary.totalCompleted}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-red-500" />
              <span className="text-sm text-muted-foreground">Erros</span>
            </div>
            <p className="text-2xl font-bold">{summary.totalErrors}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 text-blue-500" />
              <span className="text-sm text-muted-foreground">Processando</span>
            </div>
            <p className="text-2xl font-bold">{summary.totalProcessing}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-purple-500" />
              <span className="text-sm text-muted-foreground">Com Google</span>
            </div>
            <p className="text-2xl font-bold">{summary.closersWithGoogle}</p>
          </CardContent>
        </Card>
      </div>

      {/* Batch Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Processamento em Lote
          </CardTitle>
          <CardDescription>
            Processe arquivos de múltiplos closers simultaneamente
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Active Processing Panel */}
          {hasActiveProcessing && (
            <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                  <span className="font-medium text-blue-900 dark:text-blue-100">
                    Processando {runningSessions.length} closer(s)...
                  </span>
                  {estimateTimeRemaining() && (
                    <Badge variant="outline" className="text-blue-600">
                      {estimateTimeRemaining()} restante
                    </Badge>
                  )}
                </div>
                <Button 
                  variant="destructive" 
                  size="sm"
                  onClick={cancelAllProcessing}
                >
                  <StopCircle className="h-4 w-4 mr-1" />
                  Cancelar
                </Button>
              </div>

              {/* Per-closer progress */}
              <div className="space-y-2">
                {runningSessions.map(session => {
                  const closer = closerStatuses.find(c => c.userId === session.user_id);
                  const progress = session.total_files ? 
                    Math.round(((session.processed_files || 0) / session.total_files) * 100) : 0;
                  
                  return (
                    <div key={session.user_id} className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span>{closer?.fullName || 'Closer'}</span>
                        <span className="text-muted-foreground">
                          {session.processed_files || 0}/{session.total_files || 0} ({progress}%)
                        </span>
                      </div>
                      <Progress value={progress} className="h-2" />
                      {session.current_file_name && (
                        <p className="text-xs text-muted-foreground truncate">
                          Arquivo: {session.current_file_name}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Last Result */}
          {lastProcessResult && !hasActiveProcessing && (
            <div className="bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg p-3">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span className="text-green-900 dark:text-green-100">
                  Último processamento: {lastProcessResult.success} sucesso, {lastProcessResult.errors} erros
                </span>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => processBatchParallel(3, false)}
              disabled={hasActiveProcessing || summary.totalPending === 0}
              className="gap-2"
            >
              <Zap className="h-4 w-4" />
              Turbo (3x)
            </Button>
            <Button
              onClick={() => processBatchParallel(6, false)}
              disabled={hasActiveProcessing || summary.totalPending === 0}
              variant="secondary"
              className="gap-2"
            >
              <Rocket className="h-4 w-4" />
              Ultra (6x)
            </Button>
            <Button
              onClick={() => processBatchParallel(3, true)}
              disabled={hasActiveProcessing || (summary.totalPending === 0 && summary.totalErrors === 0)}
              variant="outline"
              className="gap-2"
            >
              <RotateCcw className="h-4 w-4" />
              Turbo + Reprocessar Erros
            </Button>
          </div>

          {/* Reset Buttons */}
          <div className="flex gap-2 pt-2 border-t">
            <Button
              variant="ghost"
              size="sm"
              onClick={resetErrorFiles}
              disabled={summary.totalErrors === 0}
              className="text-red-600 hover:text-red-700"
            >
              <AlertCircle className="h-4 w-4 mr-1" />
              Resetar {summary.totalErrors} erros
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={resetProcessingFiles}
              disabled={summary.totalProcessing === 0}
              className="text-orange-600 hover:text-orange-700"
            >
              <RotateCcw className="h-4 w-4 mr-1" />
              Resetar {summary.totalProcessing} travados
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={fetchImportStatuses}
            >
              <RefreshCw className="h-4 w-4 mr-1" />
              Atualizar
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Per-Closer Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Status por Closer
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[400px]">
            <div className="space-y-2">
              {closerStatuses
                .filter(closer => closer.googleConnected)
                .sort((a, b) => b.pendingImports - a.pendingImports)
                .map(closer => {
                  const session = getSessionForUser(closer.userId);
                  const isRunning = session?.status === 'running';
                  const progress = getProgressForUser(closer.userId);
                  
                  return (
                    <div 
                      key={closer.id} 
                      className={`flex items-center justify-between p-3 rounded-lg border ${
                        isRunning ? 'bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800' : ''
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium truncate">{closer.fullName}</span>
                          {isRunning && (
                            <Badge variant="outline" className="text-blue-600 border-blue-300">
                              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                              {progress}%
                            </Badge>
                          )}
                        </div>
                        
                        {isRunning && (
                          <div className="mt-2 space-y-1">
                            <Progress value={progress} className="h-1.5" />
                            <p className="text-xs text-muted-foreground truncate">
                              {session.current_file_name || 'Iniciando...'}
                            </p>
                          </div>
                        )}

                        {!isRunning && (
                          <div className="flex gap-3 text-xs text-muted-foreground mt-1">
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3 text-yellow-500" />
                              {closer.pendingImports} pendentes
                            </span>
                            <span className="flex items-center gap-1">
                              <CheckCircle className="h-3 w-3 text-green-500" />
                              {closer.completedImports} completos
                            </span>
                            {closer.errorImports > 0 && (
                              <span className="flex items-center gap-1">
                                <AlertCircle className="h-3 w-3 text-red-500" />
                                {closer.errorImports} erros
                              </span>
                            )}
                            {closer.processingImports > 0 && (
                              <span className="flex items-center gap-1">
                                <Loader2 className="h-3 w-3 text-blue-500" />
                                {closer.processingImports} processando
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="flex gap-1 ml-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => triggerImportForUser(closer.userId, closer.fullName)}
                          disabled={hasActiveProcessing}
                          title="Buscar novos arquivos do Drive"
                        >
                          <RefreshCw className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => processUserFiles(closer.userId, closer.fullName, closer.pendingImports)}
                          disabled={hasActiveProcessing || closer.pendingImports === 0}
                          title="Processar arquivos pendentes"
                        >
                          <Play className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
