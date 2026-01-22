import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Activity, AlertTriangle, CheckCircle, Clock, TrendingUp, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

interface SystemMetric {
  service: string;
  error_count: number;
  warning_count: number;
  total_operations: number;
  avg_duration_ms: number;
  max_duration_ms: number;
  success_rate_pct: number;
}

interface StuckFile {
  id: string;
  user_name: string;
  file_name: string;
  status: string;
  minutes_stuck: number;
  retry_count: number;
  error_message: string | null;
}

export default function SystemMetricsDashboard() {
  const [metrics, setMetrics] = useState<SystemMetric[]>([]);
  const [stuckFiles, setStuckFiles] = useState<StuckFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchMetrics();
    const interval = setInterval(fetchMetrics, 30000); // Atualiza a cada 30s
    return () => clearInterval(interval);
  }, []);

  const fetchMetrics = async () => {
    try {
      setRefreshing(true);
      const [metricsResult, stuckResult] = await Promise.all([
        supabase.from('system_metrics_24h').select('*'),
        supabase.from('stuck_files_report').select('*')
      ]);

      if (metricsResult.data) setMetrics(metricsResult.data as SystemMetric[]);
      if (stuckResult.data) setStuckFiles(stuckResult.data as StuckFile[]);
    } catch (error) {
      console.error('Error fetching metrics:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const totalErrors = metrics.reduce((sum, m) => sum + m.error_count, 0);
  const totalOps = metrics.reduce((sum, m) => sum + m.total_operations, 0);
  const avgSuccessRate = totalOps > 0
    ? metrics.reduce((sum, m) => sum + (m.success_rate_pct * m.total_operations), 0) / totalOps
    : 100;

  if (loading) {
    return (
      <div className="space-y-4 p-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">System Health (24h)</h3>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchMetrics}
          disabled={refreshing}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Operations</p>
                <p className="text-2xl font-bold">{totalOps.toLocaleString()}</p>
              </div>
              <Activity className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Success Rate</p>
                <p className="text-2xl font-bold">{avgSuccessRate.toFixed(1)}%</p>
              </div>
              <TrendingUp className={`h-8 w-8 ${avgSuccessRate >= 95 ? 'text-green-500' : 'text-yellow-500'}`} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Errors</p>
                <p className="text-2xl font-bold">{totalErrors}</p>
              </div>
              <AlertTriangle className={`h-8 w-8 ${totalErrors > 50 ? 'text-red-500' : 'text-yellow-500'}`} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Stuck Files</p>
                <p className="text-2xl font-bold">{stuckFiles.length}</p>
              </div>
              <Clock className={`h-8 w-8 ${stuckFiles.length > 0 ? 'text-red-500' : 'text-green-500'}`} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Service Metrics */}
      {metrics.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Service Performance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {metrics.map((metric) => (
                <div
                  key={metric.service}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                >
                  <div className="space-y-1">
                    <p className="font-medium">{metric.service}</p>
                    <p className="text-sm text-muted-foreground">
                      {metric.total_operations} ops · Avg {(metric.avg_duration_ms || 0).toFixed(0)}ms · Max {(metric.max_duration_ms || 0)}ms
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={metric.success_rate_pct >= 95 ? "default" : "destructive"}>
                      {(metric.success_rate_pct || 0).toFixed(1)}% success
                    </Badge>
                    {metric.error_count > 0 && (
                      <Badge variant="destructive">{metric.error_count} errors</Badge>
                    )}
                    {metric.warning_count > 0 && (
                      <Badge variant="secondary">{metric.warning_count} warnings</Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* No metrics message */}
      {metrics.length === 0 && (
        <Card>
          <CardContent className="py-8">
            <div className="text-center text-muted-foreground">
              <CheckCircle className="h-12 w-12 mx-auto mb-2 text-green-500" />
              <p>Nenhuma operação registrada nas últimas 24 horas</p>
              <p className="text-sm">Os logs começarão a aparecer após a primeira importação</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stuck Files Alert */}
      {stuckFiles.length > 0 && (
        <Card className="border-red-200 bg-red-50/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base text-red-700">
              <AlertTriangle className="h-5 w-5" />
              Stuck Files ({stuckFiles.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {stuckFiles.map((file) => (
                <div
                  key={file.id}
                  className="p-3 rounded-lg bg-white border border-red-200"
                >
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <p className="font-medium text-sm">{file.file_name}</p>
                      <p className="text-xs text-muted-foreground">
                        User: {file.user_name} · Stuck for {(file.minutes_stuck || 0).toFixed(0)} minutes ·{' '}
                        {file.retry_count || 0} retries
                      </p>
                      {file.error_message && (
                        <p className="text-xs text-red-600 mt-1">{file.error_message}</p>
                      )}
                    </div>
                    <Badge variant="outline" className="text-red-600 border-red-300">
                      {file.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
