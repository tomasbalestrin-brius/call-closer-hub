import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import MainLayout from '@/components/layout/MainLayout';
import ClientKanban from '@/components/clients/ClientKanban';
import NewClientDialog from '@/components/clients/NewClientDialog';
import { Input } from '@/components/ui/input';
import { Search, Users } from 'lucide-react';
import { Client } from '@/types';

interface ClientWithLastCall extends Client {
  lastCallDate?: string | null;
}

export default function Clients() {
  const { user } = useAuth();
  const [clients, setClients] = useState<ClientWithLastCall[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (user) {
      fetchClients();
    }
  }, [user]);

  const fetchClients = async () => {
    if (!user) return;

    try {
      // Fetch clients
      const { data: clientsData, error: clientsError } = await supabase
        .from('clients')
        .select('*')
        .eq('closer_id', user.id)
        .order('created_at', { ascending: false });

      if (clientsError) throw clientsError;

      // Fetch last call date for each client
      const clientIds = (clientsData || []).map(c => c.id);
      
      let lastCallDates: Record<string, string> = {};
      
      if (clientIds.length > 0) {
        const { data: callsData } = await supabase
          .from('calls')
          .select('client_id, call_date')
          .in('client_id', clientIds)
          .order('call_date', { ascending: false });
        
        // Get the most recent call date for each client
        if (callsData) {
          callsData.forEach(call => {
            if (call.client_id && !lastCallDates[call.client_id]) {
              lastCallDates[call.client_id] = call.call_date;
            }
          });
        }
      }

      // Merge last call dates with clients
      const clientsWithLastCall: ClientWithLastCall[] = (clientsData || []).map(client => ({
        ...client,
        lastCallDate: lastCallDates[client.id] || null,
      })) as ClientWithLastCall[];

      setClients(clientsWithLastCall);
    } catch (error) {
      console.error('Error fetching clients:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredClients = clients.filter((client) => {
    const matchesSearch = 
      client.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (client.email && client.email.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (client.company && client.company.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesSearch;
  });

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-display font-bold">CRM Calls</h1>
            <p className="text-muted-foreground mt-1">Arraste os cards para atualizar o status</p>
          </div>
          <NewClientDialog onClientCreated={fetchClients} />
        </div>

        {/* Search */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, email ou empresa..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Kanban Board */}
        {loading ? (
          <div className="text-muted-foreground">Carregando...</div>
        ) : filteredClients.length > 0 ? (
          <ClientKanban clients={filteredClients} onRefresh={fetchClients} />
        ) : (
          <div className="text-center py-12 bg-card rounded-xl border">
            <Users className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              {searchQuery 
                ? 'Nenhum cliente encontrado'
                : 'Nenhum cliente cadastrado ainda'}
            </p>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
