import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import MainLayout from '@/components/layout/MainLayout';
import CallCard from '@/components/calls/CallCard';
import NewCallDialog from '@/components/calls/NewCallDialog';
import CallStatsBar from '@/components/calls/CallStatsBar';
import ActiveFiltersChips from '@/components/calls/ActiveFiltersChips';
import PeriodSummary from '@/components/calls/PeriodSummary';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Phone, Trash2 } from 'lucide-react';
import { Call, CallStatus } from '@/types';
import { DateRange } from 'react-day-picker';
import { format } from 'date-fns';
import { toast } from 'sonner';

export default function Calls() {
  const { user } = useAuth();
  const { canDeleteCalls } = useUserPermissions();
  const [calls, setCalls] = useState<Call[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<CallStatus | 'all'>('all');
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [selectedCalls, setSelectedCalls] = useState<string[]>([]);

  useEffect(() => {
    if (user) {
      fetchCalls();
    }
  }, [user, dateRange]);

  const fetchCalls = async () => {
    if (!user) return;

    try {
      let query = supabase
        .from('calls')
        .select('*')
        .eq('closer_id', user.id)
        .is('merged_with_call_id', null) // Don't show merged calls
        .order('call_date', { ascending: false });

      if (dateRange?.from) {
        query = query.gte('call_date', format(dateRange.from, 'yyyy-MM-dd'));
      }
      if (dateRange?.to) {
        query = query.lte('call_date', format(dateRange.to, 'yyyy-MM-dd'));
      }

      const { data, error } = await query;

      if (error) throw error;
      setCalls((data || []) as Call[]);
    } catch (error) {
      console.error('Error fetching calls:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedCalls.length === 0) return;
    
    if (!confirm(`Tem certeza que deseja excluir ${selectedCalls.length} call(s)?`)) return;

    try {
      const { error } = await supabase
        .from('calls')
        .delete()
        .in('id', selectedCalls);

      if (error) throw error;

      toast.success(`${selectedCalls.length} call(s) excluída(s)`);
      setSelectedCalls([]);
      fetchCalls();
    } catch (error) {
      console.error('Error deleting calls:', error);
      toast.error('Erro ao excluir calls');
    }
  };

  const toggleCallSelection = (callId: string) => {
    setSelectedCalls(prev => 
      prev.includes(callId) 
        ? prev.filter(id => id !== callId)
        : [...prev, callId]
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
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-display font-bold">Calls</h1>
            <p className="text-muted-foreground mt-1">Gerencie todas as suas calls</p>
          </div>
          <div className="flex items-center gap-2">
            {canDeleteCalls && selectedCalls.length > 0 && (
              <Button 
                variant="destructive" 
                size="sm"
                onClick={handleDeleteSelected}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Excluir ({selectedCalls.length})
              </Button>
            )}
            <NewCallDialog onCallCreated={fetchCalls} />
          </div>
        </div>

        {/* Stats Bar */}
        <CallStatsBar 
          calls={calls} 
          onStatusFilter={setStatusFilter} 
          activeStatus={statusFilter} 
        />

        {/* Period Summary */}
        <PeriodSummary 
          calls={filteredCalls} 
          dateRange={dateRange}
          onDateRangeChange={setDateRange}
        />

        {/* Filters */}
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por cliente, empresa ou produto..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Active Filters Chips */}
        <ActiveFiltersChips
          searchQuery={searchQuery}
          statusFilter={statusFilter}
          dateRange={dateRange}
          onClearSearch={() => setSearchQuery('')}
          onClearStatus={() => setStatusFilter('all')}
          onClearDateRange={() => setDateRange(undefined)}
          onClearAll={() => {
            setSearchQuery('');
            setStatusFilter('all');
            setDateRange(undefined);
          }}
        />

        {/* Calls Grid */}
        {loading ? (
          <div className="text-muted-foreground">Carregando...</div>
        ) : filteredCalls.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredCalls.map((call) => (
              <div key={call.id} className="relative">
                {canDeleteCalls && (
                  <input
                    type="checkbox"
                    checked={selectedCalls.includes(call.id)}
                    onChange={() => toggleCallSelection(call.id)}
                    className="absolute top-4 right-4 z-10 w-4 h-4 accent-primary"
                  />
                )}
                <CallCard call={call} />
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 bg-card rounded-xl border">
            <Phone className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              {searchQuery || statusFilter !== 'all' || dateRange
                ? 'Nenhuma call encontrada com esses filtros'
                : 'Nenhuma call registrada ainda'}
            </p>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
