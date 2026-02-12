import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertTriangle, AlertCircle, Info, RefreshCw, FileX, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { Json } from '@/integrations/supabase/types';

interface SystemLog {
  id: string;
  timestamp: string | null;
  level: string;
  service: string;
  user_id: string | null;
  operation: string | null;
  error_message: string | null;
  metadata: Json | null;
}

interface Profile {
  user_id: string;
  full_name: string;
}

export function ErrorLogsPanel() {
  const [logs, setLogs] = useState<SystemLog[]>([]);
  const [profiles, setProfiles] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [reanalyzing, setReanalyzing] = useState<string | null>(null);
  const [reanalyzingAll, setReanalyzingAll] = useState(false);
  const [cleaningOld, setCleaningOld] = useState(false);
  const [levelFilter, setLevelFilter] = useState<string>('all');
  const [serviceFilter, setServiceFilter] = useState<string>('all');

  const fetchLogs = async () => {
    setLoading(true);

    let query = supabase
      .from('system_logs')
      .select('id, timestamp, level, service, user_id, operation, error_message, metadata')
      .in('level', ['error', 'warning', 'critical'])
      .order('timestamp', { ascending: false })
      .limit(100);

    if (levelFilter !== 'all') {
      query = query.eq('level', levelFilter);
    }
    if (serviceFilter !== 'all') {
      query = query.eq('service', serviceFilter);
    }

    const { data } = await query;
    setLogs(data || []);

    // Fetch user names
    const userIds = [...new Set((data || []).map(l => l.user_id).filter(Boolean))] as string[];
    if (userIds.length > 0) {
      const { data: profileData } = await supabase
        .from('profiles')
        .select('user_id, full_name')
        .in('user_id', userIds);

      const map: Record<string, string> = {};
      (profileData || []).forEach((p: Profile) => { map[p.user_id] = p.full_name; });
      setProfiles(map);
    }

    setLoading(false);
  };

  useEffect(() => { fetchLogs(); }, [levelFilter, serviceFilter]);

  const qualityRejections = logs.filter(l => l.operation === 'quality_rejection');
  const otherErrors = logs.filter(l => l.operation !== 'quality_rejection');

  const getLevelIcon = (level: string) => {
    switch (level) {
      case 'critical': return <AlertCircle className="w-4 h-4 text-destructive" />;
      case 'error': return <AlertTriangle className="w-4 h-4 text-destructive" />;
      case 'warning': return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
      default: return <Info className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getLevelBadge = (level: string) => {
    const variants: Record<string, string> = {
      critical: 'bg-destructive text-destructive-foreground',
      error: 'bg-destructive/80 text-destructive-foreground',
      warning: 'bg-yellow-500/20 text-yellow-700 dark:text-yellow-400',
    };
    return <Badge className={variants[level] || ''}>{level}</Badge>;
  };

  const getMetadataFileName = (metadata: Json | null): string | null => {
    if (metadata && typeof metadata === 'object' && !Array.isArray(metadata)) {
      return (metadata as Record<string, unknown>).file_name as string || null;
    }
    return null;
  };

  const getMetadataReason = (metadata: Json | null): string | null => {
    if (metadata && typeof metadata === 'object' && !Array.isArray(metadata)) {
      return (metadata as Record<string, unknown>).reason as string || null;
    }
    return null;
  };

  const getMetadataFileId = (metadata: Json | null): string | null => {
    if (metadata && typeof metadata === 'object' && !Array.isArray(metadata)) {
      return (metadata as Record<string, unknown>).fileId as string || null;
    }
    return null;
  };

  const getMetadataContentLength = (metadata: Json | null): number | null => {
    if (metadata && typeof metadata === 'object' && !Array.isArray(metadata)) {
      const val = (metadata as Record<string, unknown>).content_length;
      return typeof val === 'number' ? val : null;
    }
    return null;
  };

  const getMetadataMinLength = (metadata: Json | null): number | null => {
    if (metadata && typeof metadata === 'object' && !Array.isArray(metadata)) {
      const val = (metadata as Record<string, unknown>).minimum_length;
      return typeof val === 'number' ? val : null;
    }
    return null;
  };

  const handleReanalyze = async (driveFileId: string) => {
    setReanalyzing(driveFileId);
    const { error } = await supabase
      .from('imported_files')
      .update({ status: 'pending' as any, error_message: null })
      .eq('drive_file_id', driveFileId)
      .eq('status', 'error' as any);
    setReanalyzing(null);
    if (error) toast.error('Erro ao agendar reanálise');
    else { toast.success('Arquivo agendado para reanálise'); fetchLogs(); }
  };

  const handleReanalyzeAll = async () => {
    const fileIds = [...new Set(otherErrors.map(l => getMetadataFileId(l.metadata)).filter(Boolean))] as string[];
    if (fileIds.length === 0) { toast.info('Nenhum arquivo para reanalisar'); return; }
    setReanalyzingAll(true);
    const { error } = await supabase
      .from('imported_files')
      .update({ status: 'pending' as any, error_message: null })
      .in('drive_file_id', fileIds)
      .eq('status', 'error' as any);
    setReanalyzingAll(false);
    if (error) toast.error('Erro ao agendar reanálise em lote');
    else { toast.success(`${fileIds.length} arquivo(s) agendado(s) para reanálise`); fetchLogs(); }
  };

  const handleCleanOldLogs = async () => {
    setCleaningOld(true);
    const { error } = await supabase
      .from('system_logs')
      .delete()
      .lt('timestamp', '2026-02-01T00:00:00Z')
      .in('level', ['error', 'warning', 'critical']);
    setCleaningOld(false);
    if (error) toast.error('Erro ao limpar logs antigos');
    else { toast.success('Logs antigos removidos com sucesso'); fetchLogs(); }
  };

  const formatTimestamp = (ts: string | null) => {
    if (!ts) return '-';
    try {
      return format(new Date(ts), "dd/MM HH:mm:ss", { locale: ptBR });
    } catch {
      return ts;
    }
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex items-center gap-4">
        <Select value={levelFilter} onValueChange={setLevelFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Nível" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os níveis</SelectItem>
            <SelectItem value="critical">Critical</SelectItem>
            <SelectItem value="error">Error</SelectItem>
            <SelectItem value="warning">Warning</SelectItem>
          </SelectContent>
        </Select>

        <Select value={serviceFilter} onValueChange={setServiceFilter}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Serviço" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os serviços</SelectItem>
            <SelectItem value="import-and-analyze">import-and-analyze</SelectItem>
            <SelectItem value="sync-drive-files">sync-drive-files</SelectItem>
            <SelectItem value="stale-file-cleanup">stale-file-cleanup</SelectItem>
            <SelectItem value="analyze-call">analyze-call</SelectItem>
          </SelectContent>
        </Select>

        <Button variant="outline" size="sm" onClick={fetchLogs} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>

        <Button variant="outline" size="sm" onClick={handleCleanOldLogs} disabled={cleaningOld} className="text-destructive border-destructive/50 hover:bg-destructive/10">
          <Trash2 className={`w-4 h-4 mr-2 ${cleaningOld ? 'animate-spin' : ''}`} />
          Limpar Antigos (&lt; Fev/2026)
        </Button>
      </div>

      {/* Quality Rejections */}
      {qualityRejections.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <FileX className="w-5 h-5 text-yellow-500" />
              Calls Rejeitadas por Qualidade ({qualityRejections.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[130px]">Data</TableHead>
                  <TableHead>Arquivo</TableHead>
                  <TableHead>Usuário</TableHead>
                  <TableHead>Motivo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {qualityRejections.map(log => (
                  <TableRow key={log.id}>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatTimestamp(log.timestamp)}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {getMetadataFileName(log.metadata) || '-'}
                    </TableCell>
                    <TableCell className="text-sm">
                      {log.user_id ? profiles[log.user_id] || log.user_id.slice(0, 8) : '-'}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          {getMetadataReason(log.metadata) === 'call_muito_curta' ? 'Call muito curta' : 'Conteúdo inválido'}
                        </Badge>
                        {getMetadataReason(log.metadata) === 'call_muito_curta' && getMetadataContentLength(log.metadata) != null && (
                          <span className="text-xs text-muted-foreground">
                            ({getMetadataContentLength(log.metadata)} / {getMetadataMinLength(log.metadata) ?? '?'} chars)
                          </span>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Other Errors */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between w-full">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              Erros do Sistema ({otherErrors.length})
            </CardTitle>
            {otherErrors.some(l => getMetadataFileId(l.metadata)) && (
              <Button variant="outline" size="sm" onClick={handleReanalyzeAll} disabled={reanalyzingAll}>
                <RefreshCw className={`w-4 h-4 mr-1 ${reanalyzingAll ? 'animate-spin' : ''}`} />
                Reanalisar Todos
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {otherErrors.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Nenhum erro encontrado.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[130px]">Data</TableHead>
                  <TableHead className="w-[80px]">Nível</TableHead>
                  <TableHead>Serviço</TableHead>
                  <TableHead>Usuário</TableHead>
                  <TableHead>Mensagem</TableHead>
                  <TableHead className="w-[80px]">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {otherErrors.map(log => (
                  <TableRow key={log.id}>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatTimestamp(log.timestamp)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {getLevelIcon(log.level)}
                        {getLevelBadge(log.level)}
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{log.service}</TableCell>
                    <TableCell className="text-sm">
                      {log.user_id ? profiles[log.user_id] || log.user_id.slice(0, 8) : '-'}
                    </TableCell>
                    <TableCell className="text-sm max-w-[300px] truncate">
                      {log.error_message || log.operation || '-'}
                    </TableCell>
                    <TableCell>
                      {getMetadataFileId(log.metadata) ? (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleReanalyze(getMetadataFileId(log.metadata)!)}
                          disabled={reanalyzing === getMetadataFileId(log.metadata)}
                          title="Reanalisar"
                        >
                          <RefreshCw className={`w-4 h-4 ${reanalyzing === getMetadataFileId(log.metadata) ? 'animate-spin' : ''}`} />
                        </Button>
                      ) : '-'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
