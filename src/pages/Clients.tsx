import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { useClosersList } from '@/hooks/useClosersList';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import MainLayout from '@/components/layout/MainLayout';
import ClientKanban from '@/components/clients/ClientKanban';
import NewClientDialog from '@/components/clients/NewClientDialog';
import CRMSettingsButton from '@/components/clients/settings/CRMSettingsButton';
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
import { Search, Users, X, User, Eye } from 'lucide-react';
import { Client } from '@/types';
import { KanbanSkeleton } from '@/components/skeletons/CardListSkeleton';

interface ClientWithLastCall extends Client {
  lastCallDate?: string | null;
}

const CLIENTS_SELECT = 'id, closer_id, name, email, phone, company, niche, status, source, revenue, has_partner, main_difficulty, main_pain, notes, negotiation_notes, sale_notes, entry_value, sale_value, followup_date, contract_validity, is_sold, sold_at, is_from_indication, indication_source_id, is_super_hot, product_offered, sdr_name, funnel_source, status_changed_at, created_at, updated_at, instagram, data_completed_at, name_normalized, origin_closer_name';

export default function Clients() {
  const { user } = useAuth();
  const { isAdmin, isLeader, isIntensivo, loading: permissionsLoading } = useUserPermissions();
  const queryClient = useQueryClient();
  const { data: closers = [] } = useClosersList();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCloserId, setSelectedCloserId] = useState<string | null>(null);
  const [limit, setLimit] = useState(50);

  const targetCloserId = selectedCloserId || user?.id;

  const { data: clients = [], isLoading: loading } = useQuery({
    queryKey: ['clients', targetCloserId, limit],
    queryFn: async (): Promise<ClientWithLastCall[]> => {
      if (!user || !targetCloserId) return [];

      const [clientsResult, callsResult] = await Promise.all([
        supabase
          .from('clients')
          .select(CLIENTS_SELECT)
          .eq('closer_id', targetCloserId)
          .order('created_at', { ascending: false })
          .limit(limit),
        supabase
          .from('calls')
          .select('client_id, call_date')
          .eq('closer_id', targetCloserId)
          .is('deleted_at', null)
          .order('call_date', { ascending: false }),
      ]);

      if (clientsResult.error) throw clientsResult.error;

      const clientsData = clientsResult.data || [];
      const lastCallDates: Record<string, string> = {};
      
      if (callsResult.data) {
        callsResult.data.forEach(call => {
          if (call.client_id && !lastCallDates[call.client_id]) {
            lastCallDates[call.client_id] = call.call_date;
          }
        });
      }

      return clientsData.map(client => ({
        ...client,
        lastCallDate: lastCallDates[client.id] || null,
      })) as ClientWithLastCall[];
    },
    enabled: !!user && !permissionsLoading && !!targetCloserId,
    placeholderData: (prev) => prev,
  });

  const invalidateClients = () => {
    queryClient.invalidateQueries({ queryKey: ['clients'] });
  };

  const selectedCloser = closers.find(c => c.user_id === selectedCloserId);

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
        {selectedCloserId && selectedCloserId !== user?.id && (
          <Alert className="bg-info/10 border-info/30">
            <Eye className="w-4 h-4 text-info" />
            <AlertDescription className="flex items-center justify-between">
              <span>Visualizando CRM de: <strong>{selectedCloser?.full_name}</strong></span>
              <Button variant="ghost" size="sm" onClick={() => setSelectedCloserId(null)} className="h-7 gap-1">
                <X className="w-3 h-3" />
                Voltar ao meu CRM
              </Button>
            </AlertDescription>
          </Alert>
        )}

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-display font-bold">CRM Calls</h1>
            <p className="text-muted-foreground mt-1">Arraste os cards para atualizar o status</p>
          </div>
          <div className="flex items-center gap-2">
            <CRMSettingsButton />
            <NewClientDialog onClientCreated={invalidateClients} />
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          {!isIntensivo && (isAdmin || isLeader) && closers.length > 0 && (
            <Select value={selectedCloserId || "mine"} onValueChange={(value) => setSelectedCloserId(value === "mine" ? null : value)}>
              <SelectTrigger className="w-[220px]">
                <User className="w-4 h-4 mr-2 text-muted-foreground" />
                <SelectValue placeholder="Selecione um closer" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="mine">Meus clientes</SelectItem>
                {closers.map((closer) => (
                  <SelectItem key={closer.user_id} value={closer.user_id}>{closer.full_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Buscar por nome, email ou empresa..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10" />
          </div>
        </div>

        {loading && clients.length === 0 ? (
          <KanbanSkeleton columns={5} />
        ) : filteredClients.length > 0 ? (
          <>
            <ClientKanban clients={filteredClients} onRefresh={invalidateClients} />
            {clients.length >= limit && (
              <div className="flex justify-center pt-4">
                <Button variant="outline" onClick={() => setLimit(prev => prev + 50)}>
                  Carregar mais
                </Button>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-12 bg-card rounded-xl border">
            <Users className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              {searchQuery ? 'Nenhum cliente encontrado' : 'Nenhum cliente cadastrado ainda'}
            </p>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
