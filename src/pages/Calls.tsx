import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { useClosersList } from '@/hooks/useClosersList';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import MainLayout from '@/components/layout/MainLayout';
import CallCard from '@/components/calls/CallCard';
import { ManualAnalysisDialog } from '@/components/admin/ManualAnalysisDialog';
import NewCallDialog from '@/components/calls/NewCallDialog';
import CallStatsBar from '@/components/calls/CallStatsBar';
import ActiveFiltersChips from '@/components/calls/ActiveFiltersChips';
import PeriodSummary from '@/components/calls/PeriodSummary';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Search, Phone, Trash2, User, Eye, X, Merge, Loader2 } from 'lucide-react';
import { Call, CallStatus } from '@/types';
import { DateRange } from 'react-day-picker';
import { format } from 'date-fns';
import { toast } from 'sonner';

const CALLS_SELECT = 'id, closer_id, client_id, client_name, call_date, call_time, duration_minutes, status, score, product, sale_value, entry_value, main_errors, main_wins, loss_point, niche, main_pain, main_difficulty, ai_summary, call_conclusion, technical_analysis, merged_with_call_id, created_at, updated_at, analyzed_at, company_name, notes, observation, deleted_at, deleted_by, next_contact_date, google_doc_id, source_file_id, content_hash, has_partner, consciousness_level, decision_reason, lead_classification, closer_classification, analysis_metadata, analysis_quality_score';

export default function Calls() {
  const { user } = useAuth();
  const { canDeleteCalls, isAdmin, isLeader, loading: permissionsLoading } = useUserPermissions();
  const queryClient = useQueryClient();
  const { data: closers = [] } = useClosersList();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<CallStatus | 'all'>('all');
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [selectedCalls, setSelectedCalls] = useState<string[]>([]);
  const [merging, setMerging] = useState(false);
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false);
  const [selectedCloserId, setSelectedCloserId] = useState<string | null>(null);
  const [limit, setLimit] = useState(50);

  const targetCloserId = selectedCloserId || user?.id;

  const { data: calls = [], isLoading: loading } = useQuery({
    queryKey: ['calls', targetCloserId, dateRange?.from?.toISOString(), dateRange?.to?.toISOString(), limit],
    queryFn: async () => {
      if (!user) return [];

      let query = supabase
        .from('calls')
        .select(CALLS_SELECT)
        .eq('closer_id', targetCloserId!)
        .is('merged_with_call_id', null)
        .order('call_date', { ascending: false })
        .limit(limit);

      if (dateRange?.from) {
        query = query.gte('call_date', format(dateRange.from, 'yyyy-MM-dd'));
      }
      if (dateRange?.to) {
        query = query.lte('call_date', format(dateRange.to, 'yyyy-MM-dd'));
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as unknown as Call[];
    },
    enabled: !!user && !permissionsLoading && !!targetCloserId,
    placeholderData: (prev) => prev,
  });

  const invalidateCalls = () => {
    queryClient.invalidateQueries({ queryKey: ['calls'] });
  };

  const selectedCloser = closers.find(c => c.user_id === selectedCloserId);

  const handleDeleteSelected = async () => {
    if (selectedCalls.length === 0) return;
    try {
      const { error } = await supabase
        .from('calls')
        .delete()
        .in('id', selectedCalls);
      if (error) throw error;
      toast.success(`${selectedCalls.length} call(s) excluída(s)`);
      setSelectedCalls([]);
      setShowBulkDeleteDialog(false);
      invalidateCalls();
    } catch (error) {
      console.error('Error deleting calls:', error);
      toast.error('Erro ao excluir calls');
    }
  };

  const handleMergeSelected = async () => {
    if (selectedCalls.length !== 2) {
      toast.error('Selecione exatamente 2 calls para juntar');
      return;
    }
    setMerging(true);
    try {
      const { data, error } = await supabase.functions.invoke('merge-and-reanalyze', {
        body: { primaryCallId: selectedCalls[0], secondaryCallId: selectedCalls[1] }
      });
      if (error) throw error;
      if (data.newScore !== undefined) {
        toast.success(`Calls unidas com sucesso! Nova nota: ${data.newScore}/10`);
      } else {
        toast.success('Calls unidas com sucesso!');
      }
      setSelectedCalls([]);
      invalidateCalls();
    } catch (error) {
      console.error('Error merging calls:', error);
      toast.error('Erro ao juntar e analisar calls');
    } finally {
      setMerging(false);
    }
  };

  const toggleCallSelection = (callId: string) => {
    setSelectedCalls(prev => 
      prev.includes(callId) ? prev.filter(id => id !== callId) : [...prev, callId]
    );
  };

  const filteredCalls = calls.filter((call) => {
    const matchesSearch = call.client_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (call.product && call.product.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (call.company_name && call.company_name.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesStatus = statusFilter === 'all' || call.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <MainLayout>
      <div className="space-y-6">
        {selectedCloserId && selectedCloserId !== user?.id && (
          <Alert className="bg-info/10 border-info/30">
            <Eye className="w-4 h-4 text-info" />
            <AlertDescription className="flex items-center justify-between">
              <span>Visualizando calls de: <strong>{selectedCloser?.full_name}</strong></span>
              <Button variant="ghost" size="sm" onClick={() => setSelectedCloserId(null)} className="h-7 gap-1">
                <X className="w-3 h-3" />
                Voltar às minhas calls
              </Button>
            </AlertDescription>
          </Alert>
        )}

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-display font-bold">Calls</h1>
            <p className="text-muted-foreground mt-1">Gerencie todas as suas calls</p>
          </div>
          <div className="flex items-center gap-2">
            {selectedCalls.length === 2 && (
              <Button variant="outline" size="sm" onClick={handleMergeSelected} disabled={merging}>
                {merging ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Merge className="w-4 h-4 mr-2" />}
                {merging ? 'Juntando...' : 'Juntar (2)'}
              </Button>
            )}
            {canDeleteCalls && selectedCalls.length > 0 && (
              <Button variant="destructive" size="sm" onClick={() => setShowBulkDeleteDialog(true)}>
                <Trash2 className="w-4 h-4 mr-2" />
                Excluir ({selectedCalls.length})
              </Button>
            )}
            {isAdmin && <ManualAnalysisDialog onAnalysisComplete={invalidateCalls} />}
            <NewCallDialog onCallCreated={invalidateCalls} />
          </div>
        </div>

        <CallStatsBar calls={calls} onStatusFilter={setStatusFilter} activeStatus={statusFilter} />
        <PeriodSummary calls={filteredCalls} dateRange={dateRange} onDateRangeChange={setDateRange} />

        <div className="flex flex-col lg:flex-row gap-4">
          {(isAdmin || isLeader) && closers.length > 0 && (
            <Select value={selectedCloserId || "mine"} onValueChange={(value) => setSelectedCloserId(value === "mine" ? null : value)}>
              <SelectTrigger className="w-[220px]">
                <User className="w-4 h-4 mr-2 text-muted-foreground" />
                <SelectValue placeholder="Selecione um closer" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="mine">Minhas calls</SelectItem>
                {closers.map((closer) => (
                  <SelectItem key={closer.user_id} value={closer.user_id}>{closer.full_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Buscar por cliente, empresa ou produto..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10" />
          </div>
        </div>

        <ActiveFiltersChips
          searchQuery={searchQuery} statusFilter={statusFilter} dateRange={dateRange}
          onClearSearch={() => setSearchQuery('')} onClearStatus={() => setStatusFilter('all')}
          onClearDateRange={() => setDateRange(undefined)}
          onClearAll={() => { setSearchQuery(''); setStatusFilter('all'); setDateRange(undefined); }}
        />

        {loading ? (
          <div className="text-muted-foreground">Carregando...</div>
        ) : filteredCalls.length > 0 ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredCalls.map((call) => (
                <div key={call.id} className="relative">
                  {(canDeleteCalls || isAdmin || isLeader) && (
                    <input type="checkbox" checked={selectedCalls.includes(call.id)} onChange={() => toggleCallSelection(call.id)} className="absolute top-4 right-12 z-10 w-4 h-4 accent-primary" />
                  )}
                  <CallCard call={call} canDelete={canDeleteCalls} onCallUpdated={invalidateCalls} />
                </div>
              ))}
            </div>
            {calls.length >= limit && (
              <div className="flex justify-center pt-4">
                <Button variant="outline" onClick={() => setLimit(prev => prev + 50)}>
                  Carregar mais
                </Button>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-12 bg-card rounded-xl border">
            <Phone className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              {searchQuery || statusFilter !== 'all' || dateRange ? 'Nenhuma call encontrada com esses filtros' : 'Nenhuma call registrada ainda'}
            </p>
          </div>
        )}

        <AlertDialog open={showBulkDeleteDialog} onOpenChange={setShowBulkDeleteDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir calls</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja excluir {selectedCalls.length} call(s)? Esta ação não pode ser desfeita.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteSelected} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                Excluir
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </MainLayout>
  );
}
