import { useState, useEffect } from 'react';
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
  Play
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
}

interface ImportSummary {
  totalCompleted: number;
  totalPending: number;
  totalErrors: number;
  total: number;
}

export function ImportStatusPanel() {
  const [closerStatuses, setCloserStatuses] = useState<CloserImportStatus[]>([]);
  const [summary, setSummary] = useState<ImportSummary>({ totalCompleted: 0, totalPending: 0, totalErrors: 0, total: 0 });
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [lastProcessResult, setLastProcessResult] = useState<{
    processed: number;
    success: number;
    errors: number;
    remaining: number;
  } | null>(null);

  useEffect(() => {
    fetchImportStatuses();
  }, []);

  const fetchImportStatuses = async () => {
    try {
      // Get profiles with Google connected
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('user_id, full_name, google_connected')
        .order('full_name');

      if (profilesError) throw profilesError;

      // Get import file counts grouped by user and status
      const { data: importCounts, error: countsError } = await supabase
        .from('imported_files')
        .select('user_id, status');

      if (countsError) throw countsError;

      // Get call counts per user
      const { data: callCounts, error: callsError } = await supabase
        .from('calls')
        .select('closer_id');

      if (callsError) throw callsError;

      // Process data
      const statusMap = new Map<string, { completed: number; pending: number; error: number }>();
      (importCounts || []).forEach(item => {
        const current = statusMap.get(item.user_id) || { completed: 0, pending: 0, error: 0 };
        if (item.status === 'completed') current.completed++;
        else if (item.status === 'pending') current.pending++;
        else if (item.status === 'error') current.error++;
        else if (item.status === 'processing') current.pending++; // Count processing as pending
        statusMap.set(item.user_id, current);
      });

      const callCountMap = new Map<string, number>();
      (callCounts || []).forEach(call => {
        callCountMap.set(call.closer_id, (callCountMap.get(call.closer_id) || 0) + 1);
      });

      const statuses: CloserImportStatus[] = (profiles || [])
        .filter(p => p.google_connected)
        .map(profile => {
          const imports = statusMap.get(profile.user_id) || { completed: 0, pending: 0, error: 0 };
          return {
            userId: profile.user_id,
            fullName: profile.full_name,
            googleConnected: profile.google_connected || false,
            totalCalls: callCountMap.get(profile.user_id) || 0,
            completedImports: imports.completed,
            pendingImports: imports.pending,
            errorImports: imports.error,
          };
        })
        .filter(s => s.completedImports > 0 || s.pendingImports > 0 || s.errorImports > 0);

      setCloserStatuses(statuses);

      // Calculate totals
      const totalCompleted = statuses.reduce((sum, s) => sum + s.completedImports, 0);
      const totalPending = statuses.reduce((sum, s) => sum + s.pendingImports, 0);
      const totalErrors = statuses.reduce((sum, s) => sum + s.errorImports, 0);
      setSummary({
        totalCompleted,
        totalPending,
        totalErrors,
        total: totalCompleted + totalPending + totalErrors,
      });

    } catch (error) {
      console.error('Error fetching import statuses:', error);
      toast.error('Erro ao carregar status de importação');
    } finally {
      setLoading(false);
    }
  };

  const processAllPending = async () => {
    setProcessing(true);
    setLastProcessResult(null);

    try {
      toast.info('Iniciando processamento de arquivos pendentes...');

      const { data, error } = await supabase.functions.invoke('process-pending-files', {
        body: { maxFilesPerUser: 10, resetErrors: true }
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
            `Processados ${data.summary.totalSuccess} de ${data.summary.totalProcessed} arquivos. ` +
            `${data.summary.remainingPending} pendentes restantes.`
          );
        } else {
          toast.info('Nenhum arquivo pendente para processar.');
        }
      }

      // Refresh statuses
      await fetchImportStatuses();
    } catch (error) {
      console.error('Error processing pending files:', error);
      toast.error('Erro ao processar arquivos pendentes');
    } finally {
      setProcessing(false);
    }
  };

  const progressPercent = summary.total > 0 
    ? Math.round((summary.totalCompleted / summary.total) * 100) 
    : 0;

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
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
              Visão geral de arquivos importados, pendentes e com erro
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm"
              onClick={fetchImportStatuses}
              disabled={loading}
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>
            <Button 
              onClick={processAllPending}
              disabled={processing || summary.totalPending + summary.totalErrors === 0}
              className="gradient-primary"
            >
              {processing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Processando...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 mr-2" />
                  Processar {summary.totalPending + summary.totalErrors} Pendentes
                </>
              )}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Summary Stats */}
        <div className="grid gap-4 md:grid-cols-4">
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

        {/* Last Process Result */}
        {lastProcessResult && (
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

        {/* Per Closer Breakdown */}
        {closerStatuses.length > 0 && (
          <div className="space-y-3">
            <h4 className="font-medium text-sm text-muted-foreground">Por Closer</h4>
            <div className="space-y-2">
              {closerStatuses.map(closer => {
                const total = closer.completedImports + closer.pendingImports + closer.errorImports;
                const percent = total > 0 ? Math.round((closer.completedImports / total) * 100) : 0;
                
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
                      <div className="w-16 text-right text-sm text-muted-foreground">
                        {percent}%
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {closerStatuses.length === 0 && (
          <p className="text-center text-muted-foreground py-4">
            Nenhum arquivo importado ainda
          </p>
        )}
      </CardContent>
    </Card>
  );
}
