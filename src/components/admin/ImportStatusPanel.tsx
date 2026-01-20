import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  RefreshCw, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  Loader2,
  FileText,
  Play,
  Zap,
  Rocket,
  RotateCcw,
  Users
} from 'lucide-react';
import { toast } from 'sonner';

interface CloserImportStatus {
  userId: string;
  fullName: string;
  googleConnected: boolean;
  totalCalls: number;
  completedImports: number;
  pendingImports: number;
  errorImports: number;
  processingImports: number;
}

interface ImportSummary {
  totalCompleted: number;
  totalPending: number;
  totalErrors: number;
  totalProcessing: number;
  total: number;
}

interface LiveProgress {
  sessionId: string;
  totalFiles: number;
  processedFiles: number;
  successCount: number;
  errorCount: number;
  currentFileName: string | null;
  currentCloserName: string | null;
  status: 'running' | 'completed' | 'error';
  startedAt: Date;
}

export function ImportStatusPanel() {
  const [closerStatuses, setCloserStatuses] = useState<CloserImportStatus[]>([]);
  const [summary, setSummary] = useState<ImportSummary>({ 
    totalCompleted: 0, 
    totalPending: 0, 
    totalErrors: 0, 
    totalProcessing: 0,
    total: 0 
  });
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [processingUserId, setProcessingUserId] = useState<string | null>(null);
  const [liveProgress, setLiveProgress] = useState<LiveProgress | null>(null);
  const [parallelMode, setParallelMode] = useState<number>(1);
  const [lastProcessResult, setLastProcessResult] = useState<{
    processed: number;
    success: number;
    errors: number;
    remaining: number;
  } | null>(null);

  useEffect(() => {
    fetchImportStatuses();
  }, []);

  // Subscribe to realtime progress updates
  useEffect(() => {
    if (!processing) {
      setLiveProgress(null);
      return;
    }

    console.log('Setting up realtime subscription for import progress...');

    const channel = supabase
      .channel('import-progress-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'import_progress',
        },
        (payload) => {
          console.log('Realtime update received:', payload);
          const data = payload.new as Record<string, unknown>;
          
          if (data && data.status) {
            setLiveProgress({
              sessionId: data.session_id as string,
              totalFiles: data.total_files as number,
              processedFiles: data.processed_files as number,
              successCount: data.success_count as number,
              errorCount: data.error_count as number,
              currentFileName: data.current_file_name as string | null,
              currentCloserName: data.current_closer_name as string | null,
              status: data.status as 'running' | 'completed' | 'error',
              startedAt: new Date(data.started_at as string),
            });

            // If completed, stop processing state
            if (data.status === 'completed' || data.status === 'error') {
              console.log('Processing completed or error, will refresh...');
              setTimeout(() => {
                setProcessing(false);
                fetchImportStatuses();
              }, 1000);
            }
          }
        }
      )
      .subscribe((status) => {
        console.log('Realtime subscription status:', status);
      });

    return () => {
      console.log('Cleaning up realtime subscription');
      supabase.removeChannel(channel);
    };
  }, [processing]);

  const fetchImportStatuses = async () => {
    setLoading(true);
    try {
      console.log('Fetching import statuses...');
      
      // Get profiles with Google connected
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('user_id, full_name, google_connected')
        .order('full_name');

      if (profilesError) throw profilesError;
      console.log('Profiles fetched:', profiles?.length);

      // Get import file counts grouped by user and status
      const { data: importCounts, error: countsError } = await supabase
        .from('imported_files')
        .select('user_id, status');

      if (countsError) throw countsError;
      console.log('Import counts fetched:', importCounts?.length);

      // Get call counts per user
      const { data: callCounts, error: callsError } = await supabase
        .from('calls')
        .select('closer_id');

      if (callsError) throw callsError;

      // Process data
      const statusMap = new Map<string, { completed: number; pending: number; error: number; processing: number }>();
      (importCounts || []).forEach(item => {
        const current = statusMap.get(item.user_id) || { completed: 0, pending: 0, error: 0, processing: 0 };
        if (item.status === 'completed') current.completed++;
        else if (item.status === 'pending') current.pending++;
        else if (item.status === 'error') current.error++;
        else if (item.status === 'processing') current.processing++;
        statusMap.set(item.user_id, current);
      });

      const callCountMap = new Map<string, number>();
      (callCounts || []).forEach(call => {
        callCountMap.set(call.closer_id, (callCountMap.get(call.closer_id) || 0) + 1);
      });

      const statuses: CloserImportStatus[] = (profiles || [])
        .filter(p => p.google_connected)
        .map(profile => {
          const imports = statusMap.get(profile.user_id) || { completed: 0, pending: 0, error: 0, processing: 0 };
          return {
            userId: profile.user_id,
            fullName: profile.full_name,
            googleConnected: profile.google_connected || false,
            totalCalls: callCountMap.get(profile.user_id) || 0,
            completedImports: imports.completed,
            pendingImports: imports.pending,
            errorImports: imports.error,
            processingImports: imports.processing,
          };
        })
        .filter(s => s.completedImports > 0 || s.pendingImports > 0 || s.errorImports > 0 || s.processingImports > 0);

      console.log('Closer statuses:', statuses);
      setCloserStatuses(statuses);

      // Calculate totals
      const totalCompleted = statuses.reduce((sum, s) => sum + s.completedImports, 0);
      const totalPending = statuses.reduce((sum, s) => sum + s.pendingImports, 0);
      const totalErrors = statuses.reduce((sum, s) => sum + s.errorImports, 0);
      const totalProcessing = statuses.reduce((sum, s) => sum + s.processingImports, 0);
      
      const newSummary = {
        totalCompleted,
        totalPending,
        totalErrors,
        totalProcessing,
        total: totalCompleted + totalPending + totalErrors + totalProcessing,
      };
      console.log('Summary:', newSummary);
      setSummary(newSummary);

    } catch (error) {
      console.error('Error fetching import statuses:', error);
      toast.error('Erro ao carregar status de importação');
    } finally {
      setLoading(false);
    }
  };

  const estimateTimeRemaining = useCallback((progress: LiveProgress | null) => {
    if (!progress || progress.processedFiles === 0) return '...';
    
    const elapsed = Date.now() - progress.startedAt.getTime();
    const avgTimePerFile = elapsed / progress.processedFiles;
    const remaining = progress.totalFiles - progress.processedFiles;
    const estimatedMs = remaining * avgTimePerFile;
    
    const minutes = Math.ceil(estimatedMs / 60000);
    if (minutes < 1) return 'menos de 1 min';
    if (minutes === 1) return '1 minuto';
    return `${minutes} minutos`;
  }, []);

  const estimateParallelTime = (pendingCount: number, parallelClosers: number) => {
    // With parallel processing: ~5s per file, divided by parallel closers
    const effectiveTimePerFile = 5 / parallelClosers;
    const totalSeconds = pendingCount * effectiveTimePerFile;
    const minutes = Math.ceil(totalSeconds / 60);
    return minutes < 1 ? '< 1' : minutes.toString();
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
        .update({ status: 'pending' })
        .eq('status', 'processing');

      if (error) throw error;
      
      toast.success('Arquivos em processamento resetados');
      await fetchImportStatuses();
    } catch (error) {
      console.error('Error resetting processing files:', error);
      toast.error('Erro ao resetar arquivos');
    }
  };

  const processBatchParallel = async (maxFilesPerUser: number, parallelClosers: number, resetErrors: boolean = false) => {
    setProcessing(true);
    setParallelMode(parallelClosers);
    setLastProcessResult(null);
    setLiveProgress(null);

    try {
      const pendingTotal = summary.totalPending + (resetErrors ? summary.totalErrors : 0);
      const estimatedTime = estimateParallelTime(pendingTotal, parallelClosers);
      
      toast.info(
        `🚀 Processamento paralelo iniciado!\n` +
        `${parallelClosers} closers simultâneos • ~${estimatedTime} min estimado`,
        { duration: 5000 }
      );

      const { data, error } = await supabase.functions.invoke('process-pending-files', {
        body: { 
          maxFilesPerUser, 
          parallelClosers,
          resetErrors,
          fileDelayMs: 3000 // 3s delay between files
        }
      });

      if (error) throw error;

      if (data?.summary) {
        setLastProcessResult({
          processed: data.summary.totalProcessed,
          success: data.summary.totalSuccess,
          errors: data.summary.totalErrors,
          remaining: data.summary.remainingPending,
        });

        if (data.summary.totalProcessed > 0) {
          toast.success(
            `✅ ${data.summary.totalSuccess} de ${data.summary.totalProcessed} processados! ` +
            `${data.summary.remainingPending} pendentes restantes.`,
            { duration: 8000 }
          );
        } else {
          toast.info('Nenhum arquivo pendente para processar.');
        }
      }

      await fetchImportStatuses();
    } catch (error) {
      console.error('Error processing files:', error);
      toast.error('Erro ao processar arquivos. Verifique os logs.');
    } finally {
      setProcessing(false);
      setLiveProgress(null);
      setParallelMode(1);
    }
  };

  const processUserFiles = async (userId: string, userName: string, pendingCount: number) => {
    setProcessing(true);
    setProcessingUserId(userId);
    setLastProcessResult(null);
    setLiveProgress(null);

    try {
      const estimatedTime = Math.ceil(pendingCount * 5 / 60); // 5s per file
      toast.info(`Processando ${pendingCount} arquivos de ${userName} (~${estimatedTime} min)...`);

      const { data, error } = await supabase.functions.invoke('process-pending-files', {
        body: { 
          targetUserId: userId,
          maxFilesPerUser: 100,
          resetErrors: true,
          fileDelayMs: 3000
        }
      });

      if (error) throw error;

      if (data?.summary) {
        setLastProcessResult({
          processed: data.summary.totalProcessed,
          success: data.summary.totalSuccess,
          errors: data.summary.totalErrors,
          remaining: data.summary.remainingPending,
        });

        if (data.summary.totalProcessed > 0) {
          toast.success(
            `${userName}: ${data.summary.totalSuccess} de ${data.summary.totalProcessed} processados. ` +
            `${data.summary.remainingPending} restantes.`
          );
        } else {
          toast.info(`${userName}: Nenhum arquivo pendente.`);
        }
      }

      await fetchImportStatuses();
    } catch (error) {
      console.error(`Error processing files for ${userName}:`, error);
      toast.error(`Erro ao processar arquivos de ${userName}`);
    } finally {
      setProcessing(false);
      setProcessingUserId(null);
      setLiveProgress(null);
    }
  };

  const progressPercent = summary.total > 0 
    ? Math.round((summary.totalCompleted / summary.total) * 100) 
    : 0;

  const liveProgressPercent = liveProgress && liveProgress.totalFiles > 0
    ? Math.round((liveProgress.processedFiles / liveProgress.totalFiles) * 100)
    : 0;

  const pendingTotal = summary.totalPending + summary.totalErrors;
  const closersWithPending = closerStatuses.filter(c => c.pendingImports + c.errorImports > 0).length;

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
          <span className="ml-2 text-muted-foreground">Carregando status...</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <CardTitle className="font-display flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Status de Importação do Drive
            </CardTitle>
            <CardDescription>
              Controle total sobre importação e análise de transcrições
            </CardDescription>
          </div>
          <Button 
            variant="outline" 
            size="sm"
            onClick={fetchImportStatuses}
            disabled={loading || processing}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Summary Stats */}
        <div className="grid gap-4 md:grid-cols-5">
          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
            <div className="p-2 rounded-full bg-success/10">
              <CheckCircle2 className="w-5 h-5 text-success" />
            </div>
            <div>
              <p className="text-2xl font-bold">{summary.totalCompleted}</p>
              <p className="text-xs text-muted-foreground">Concluídos</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
            <div className="p-2 rounded-full bg-amber-500/10">
              <Clock className="w-5 h-5 text-amber-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{summary.totalPending}</p>
              <p className="text-xs text-muted-foreground">Pendentes</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
            <div className="p-2 rounded-full bg-blue-500/10">
              <Loader2 className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{summary.totalProcessing}</p>
              <p className="text-xs text-muted-foreground">Processando</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
            <div className="p-2 rounded-full bg-destructive/10">
              <AlertCircle className="w-5 h-5 text-destructive" />
            </div>
            <div>
              <p className="text-2xl font-bold">{summary.totalErrors}</p>
              <p className="text-xs text-muted-foreground">Erros</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
            <div className="p-2 rounded-full bg-primary/10">
              <FileText className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{summary.total}</p>
              <p className="text-xs text-muted-foreground">Total</p>
            </div>
          </div>
        </div>

        {/* Overall Progress */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Progresso Geral</span>
            <span className="font-medium">{progressPercent}%</span>
          </div>
          <Progress value={progressPercent} className="h-2" />
        </div>

        {/* Processing Controls */}
        <div className="p-4 rounded-lg border bg-muted/30 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-medium flex items-center gap-2">
              <Rocket className="w-4 h-4 text-primary" />
              Controles de Processamento
            </h4>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Users className="w-4 h-4" />
              {closersWithPending} closers com pendentes
            </div>
          </div>

          {/* Quick Reset Buttons */}
          <div className="flex gap-2 flex-wrap">
            {summary.totalErrors > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={resetErrorFiles}
                disabled={processing}
                className="text-destructive border-destructive/30 hover:bg-destructive/10"
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                Resetar {summary.totalErrors} Erros
              </Button>
            )}
            {summary.totalProcessing > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={resetProcessingFiles}
                disabled={processing}
                className="text-blue-600 border-blue-500/30 hover:bg-blue-500/10"
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                Resetar {summary.totalProcessing} Travados
              </Button>
            )}
          </div>

          {/* Parallel Processing Buttons */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Button 
              variant="outline"
              onClick={() => processBatchParallel(25, 1, true)}
              disabled={processing || pendingTotal === 0}
              className="h-auto py-3 flex flex-col items-center gap-1"
            >
              {processing && parallelMode === 1 ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Play className="w-5 h-5" />
              )}
              <span className="font-medium">Sequencial</span>
              <span className="text-xs text-muted-foreground">
                1 closer • ~{estimateParallelTime(pendingTotal, 1)} min
              </span>
            </Button>

            <Button 
              variant="outline"
              onClick={() => processBatchParallel(25, 3, true)}
              disabled={processing || pendingTotal === 0}
              className="h-auto py-3 flex flex-col items-center gap-1 border-amber-500/50 text-amber-600 hover:bg-amber-500/10"
            >
              {processing && parallelMode === 3 ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Zap className="w-5 h-5" />
              )}
              <span className="font-medium">Turbo</span>
              <span className="text-xs">
                3 paralelos • ~{estimateParallelTime(pendingTotal, 3)} min
              </span>
            </Button>

            <Button 
              onClick={() => processBatchParallel(25, 6, true)}
              disabled={processing || pendingTotal === 0}
              className="h-auto py-3 flex flex-col items-center gap-1 gradient-primary"
            >
              {processing && parallelMode === 6 ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Rocket className="w-5 h-5" />
              )}
              <span className="font-medium">Ultra</span>
              <span className="text-xs">
                6 paralelos • ~{estimateParallelTime(pendingTotal, 6)} min
              </span>
            </Button>

            <Button 
              variant="secondary"
              onClick={() => processBatchParallel(100, closersWithPending || 1, true)}
              disabled={processing || pendingTotal === 0}
              className="h-auto py-3 flex flex-col items-center gap-1"
            >
              {processing && parallelMode > 6 ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <Users className="w-5 h-5" />
                </>
              )}
              <span className="font-medium">Todos ({pendingTotal})</span>
              <span className="text-xs text-muted-foreground">
                {closersWithPending} closers simultâneos
              </span>
            </Button>
          </div>
        </div>

        {/* Live Progress Panel */}
        {processing && (
          <div className="p-4 rounded-lg border-2 border-primary/30 bg-primary/5 space-y-4 animate-in fade-in duration-300">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Zap className="w-5 h-5 text-primary animate-pulse" />
                  <div className="absolute inset-0 bg-primary/30 blur-md rounded-full animate-pulse" />
                </div>
                <span className="font-semibold text-primary">
                  Processando {parallelMode > 1 ? `(${parallelMode} paralelos)` : 'Sequencial'}
                </span>
              </div>
              {liveProgress && (
                <Badge variant="outline" className="bg-primary/10 border-primary/30">
                  {liveProgress.processedFiles} / {liveProgress.totalFiles}
                </Badge>
              )}
            </div>

            {/* Progress Bar */}
            <div className="space-y-2">
              <Progress 
                value={liveProgressPercent} 
                className="h-3"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{liveProgressPercent}% concluído</span>
                {liveProgress && (
                  <span>~{estimateTimeRemaining(liveProgress)} restantes</span>
                )}
              </div>
            </div>

            {/* Current File */}
            {liveProgress?.currentFileName && (
              <div className="flex items-center gap-2 p-3 rounded-md bg-background/80 border">
                <FileText className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{liveProgress.currentFileName}</p>
                  {liveProgress.currentCloserName && (
                    <p className="text-xs text-muted-foreground">
                      Closer: {liveProgress.currentCloserName}
                    </p>
                  )}
                </div>
                <Loader2 className="w-4 h-4 animate-spin text-primary flex-shrink-0" />
              </div>
            )}

            {/* Live Counters */}
            {liveProgress && (
              <div className="flex gap-4 text-sm">
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-success" />
                  <span className="font-medium">{liveProgress.successCount}</span>
                  <span className="text-muted-foreground">sucesso</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 text-destructive" />
                  <span className="font-medium">{liveProgress.errorCount}</span>
                  <span className="text-muted-foreground">erros</span>
                </div>
              </div>
            )}

            {!liveProgress && (
              <div className="flex items-center justify-center py-2 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                Aguardando início do processamento...
              </div>
            )}
          </div>
        )}

        {/* Last Process Result */}
        {lastProcessResult && !processing && (
          <div className="p-4 rounded-lg bg-muted/30 border border-border">
            <h4 className="font-medium mb-2">Último Processamento</h4>
            <div className="grid grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Processados</p>
                <p className="font-medium">{lastProcessResult.processed}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Sucesso</p>
                <p className="font-medium text-success">{lastProcessResult.success}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Erros</p>
                <p className="font-medium text-destructive">{lastProcessResult.errors}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Restantes</p>
                <p className="font-medium">{lastProcessResult.remaining}</p>
              </div>
            </div>
          </div>
        )}

        {/* Per Closer Breakdown with Process Buttons */}
        {closerStatuses.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-medium text-sm text-muted-foreground">Processar por Closer</h4>
              <p className="text-xs text-muted-foreground">Clique no botão para processar os pendentes de cada closer</p>
            </div>
            <div className="space-y-2">
              {closerStatuses
                .sort((a, b) => (b.pendingImports + b.errorImports) - (a.pendingImports + a.errorImports))
                .map(closer => {
                const total = closer.completedImports + closer.pendingImports + closer.errorImports + closer.processingImports;
                const percent = total > 0 ? Math.round((closer.completedImports / total) * 100) : 0;
                const pendingTotal = closer.pendingImports + closer.errorImports;
                const estimatedMin = Math.ceil(pendingTotal * 5 / 60); // 5s per file with parallel
                const isProcessingThis = processingUserId === closer.userId;
                
                return (
                  <div key={closer.userId} className="flex items-center justify-between p-3 rounded-lg border bg-card">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium">
                        {closer.fullName.charAt(0)}
                      </div>
                      <div>
                        <p className="font-medium text-sm">{closer.fullName}</p>
                        <p className="text-xs text-muted-foreground">{closer.totalCalls} calls no sistema</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="bg-success/10 text-success border-success/30">
                        <CheckCircle2 className="w-3 h-3 mr-1" />
                        {closer.completedImports}
                      </Badge>
                      {closer.processingImports > 0 && (
                        <Badge variant="outline" className="bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-800">
                          <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                          {closer.processingImports}
                        </Badge>
                      )}
                      {closer.pendingImports > 0 && (
                        <Badge variant="outline" className="bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800">
                          <Clock className="w-3 h-3 mr-1" />
                          {closer.pendingImports}
                        </Badge>
                      )}
                      {closer.errorImports > 0 && (
                        <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/30">
                          <AlertCircle className="w-3 h-3 mr-1" />
                          {closer.errorImports}
                        </Badge>
                      )}
                      <div className="w-12 text-right text-sm text-muted-foreground">
                        {percent}%
                      </div>
                      {pendingTotal > 0 ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => processUserFiles(closer.userId, closer.fullName, pendingTotal)}
                          disabled={processing}
                          className="ml-2 min-w-[120px] border-primary text-primary hover:bg-primary/10"
                        >
                          {isProcessingThis ? (
                            <>
                              <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                              Processando...
                            </>
                          ) : (
                            <>
                              <Play className="w-3 h-3 mr-1" />
                              {pendingTotal} (~{estimatedMin}min)
                            </>
                          )}
                        </Button>
                      ) : (
                        <Badge variant="outline" className="ml-2 min-w-[120px] justify-center bg-success/10 text-success border-success/30">
                          <CheckCircle2 className="w-3 h-3 mr-1" />
                          Completo
                        </Badge>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {closerStatuses.length === 0 && (
          <p className="text-center text-muted-foreground py-4">
            Nenhum arquivo importado ainda. Verifique se os closers têm Google Drive conectado.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
