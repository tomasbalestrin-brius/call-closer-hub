import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import MainLayout from '@/components/layout/MainLayout';
import CallCard from '@/components/calls/CallCard';
import NewCallDialog from '@/components/calls/NewCallDialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Phone } from 'lucide-react';
import { Call, CallStatus } from '@/types';

export default function Calls() {
  const { user } = useAuth();
  const [calls, setCalls] = useState<Call[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<CallStatus | 'all'>('all');

  useEffect(() => {
    if (user) {
      fetchCalls();
    }
  }, [user]);

  const fetchCalls = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('calls')
        .select('*')
        .eq('closer_id', user.id)
        .order('call_date', { ascending: false });

      if (error) throw error;
      setCalls((data || []) as Call[]);
    } catch (error) {
      console.error('Error fetching calls:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredCalls = calls.filter((call) => {
    const matchesSearch = call.client_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (call.product && call.product.toLowerCase().includes(searchQuery.toLowerCase()));
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
          <NewCallDialog onCallCreated={fetchCalls} />
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por cliente ou produto..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as CallStatus | 'all')}>
            <SelectTrigger className="w-full sm:w-[200px]">
              <SelectValue placeholder="Filtrar por status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              <SelectItem value="pendente">Pendente</SelectItem>
              <SelectItem value="em_andamento">Em andamento</SelectItem>
              <SelectItem value="follow_up">Follow-up</SelectItem>
              <SelectItem value="proposta_enviada">Proposta enviada</SelectItem>
              <SelectItem value="vendido">Vendido</SelectItem>
              <SelectItem value="perdido">Perdido</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Calls Grid */}
        {loading ? (
          <div className="text-muted-foreground">Carregando...</div>
        ) : filteredCalls.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredCalls.map((call) => (
              <CallCard key={call.id} call={call} />
            ))}
          </div>
        ) : (
          <div className="text-center py-12 bg-card rounded-xl border">
            <Phone className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              {searchQuery || statusFilter !== 'all' 
                ? 'Nenhuma call encontrada com esses filtros'
                : 'Nenhuma call registrada ainda'}
            </p>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
