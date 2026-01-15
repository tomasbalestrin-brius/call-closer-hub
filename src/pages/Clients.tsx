import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import MainLayout from '@/components/layout/MainLayout';
import ClientKanban from '@/components/clients/ClientKanban';
import NewClientDialog from '@/components/clients/NewClientDialog';
import CRMSettingsButton from '@/components/clients/settings/CRMSettingsButton';
import { useClientTags } from '@/hooks/useClientTags';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Search, Users, X, Tag, User, Eye } from 'lucide-react';
import { Client } from '@/types';

interface ClientWithLastCall extends Client {
  lastCallDate?: string | null;
}

interface CloserProfile {
  user_id: string;
  full_name: string;
}

export default function Clients() {
  const { user } = useAuth();
  const { isAdmin, isLeader, loading: permissionsLoading } = useUserPermissions();
  const [clients, setClients] = useState<ClientWithLastCall[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTagId, setSelectedTagId] = useState<string | null>(null);
  const [clientTagMap, setClientTagMap] = useState<Record<string, string[]>>({});
  const { tags } = useClientTags();
  
  // Closer filter for admin/leader
  const [closers, setClosers] = useState<CloserProfile[]>([]);
  const [selectedCloserId, setSelectedCloserId] = useState<string | null>(null);

  // Fetch closers list for admin/leader
  useEffect(() => {
    if (user && (isAdmin || isLeader) && !permissionsLoading) {
      fetchClosers();
    }
  }, [user, isAdmin, isLeader, permissionsLoading]);

  const fetchClosers = async () => {
    if (!user) return;

    try {
      if (isAdmin) {
        // Admin can see all closers
        const { data, error } = await supabase
          .from('profiles')
          .select('user_id, full_name')
          .order('full_name');
        
        if (error) throw error;
        setClosers((data || []).filter(p => p.user_id !== user.id));
      } else if (isLeader) {
        // Leader can only see closers from their squads
        const { data: squadMembers, error } = await supabase
          .from('squad_members')
          .select(`
            user_id,
            squads!inner(created_by)
          `)
          .eq('squads.created_by', user.id);

        if (error) throw error;

        const memberIds = (squadMembers || []).map(m => m.user_id).filter(id => id !== user.id);
        
        if (memberIds.length > 0) {
          const { data: profiles } = await supabase
            .from('profiles')
            .select('user_id, full_name')
            .in('user_id', memberIds)
            .order('full_name');
          
          setClosers(profiles || []);
        }
      }
    } catch (error) {
      console.error('Error fetching closers:', error);
    }
  };

  useEffect(() => {
    if (user && !permissionsLoading) {
      fetchClients();
    }
  }, [user, selectedCloserId, permissionsLoading]);

  const fetchClients = async () => {
    if (!user) return;

    try {
      // Determine which closer_id to use
      const targetCloserId = selectedCloserId || user.id;

      // Fetch clients
      const { data: clientsData, error: clientsError } = await supabase
        .from('clients')
        .select('*')
        .eq('closer_id', targetCloserId)
        .order('created_at', { ascending: false });

      if (clientsError) throw clientsError;

      // Fetch last call date for each client
      const clientIds = (clientsData || []).map(c => c.id);
      
      let lastCallDates: Record<string, string> = {};
      let tagMap: Record<string, string[]> = {};
      
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

        // Fetch tag assignments for all clients
        const { data: tagAssignments } = await supabase
          .from('client_tag_assignments')
          .select('client_id, tag_id')
          .in('client_id', clientIds);

        if (tagAssignments) {
          tagAssignments.forEach(assignment => {
            if (!tagMap[assignment.client_id]) {
              tagMap[assignment.client_id] = [];
            }
            tagMap[assignment.client_id].push(assignment.tag_id);
          });
        }
      }

      setClientTagMap(tagMap);

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

  const selectedCloser = closers.find(c => c.user_id === selectedCloserId);

  const filteredClients = clients.filter((client) => {
    const matchesSearch = 
      client.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (client.email && client.email.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (client.company && client.company.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesTag = !selectedTagId || (clientTagMap[client.id]?.includes(selectedTagId));
    
    return matchesSearch && matchesTag;
  });

  const selectedTag = tags.find(t => t.id === selectedTagId);

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Viewing other closer banner */}
        {selectedCloserId && selectedCloserId !== user?.id && (
          <Alert className="bg-info/10 border-info/30">
            <Eye className="w-4 h-4 text-info" />
            <AlertDescription className="flex items-center justify-between">
              <span>
                Visualizando CRM de: <strong>{selectedCloser?.full_name}</strong>
              </span>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setSelectedCloserId(null)}
                className="h-7 gap-1"
              >
                <X className="w-3 h-3" />
                Voltar ao meu CRM
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-display font-bold">CRM Calls</h1>
            <p className="text-muted-foreground mt-1">Arraste os cards para atualizar o status</p>
          </div>
          <div className="flex items-center gap-2">
            <CRMSettingsButton />
            <NewClientDialog onClientCreated={fetchClients} />
          </div>
        </div>

        {/* Search and Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Closer Filter for Admin/Leader */}
          {(isAdmin || isLeader) && closers.length > 0 && (
            <Select
              value={selectedCloserId || "mine"}
              onValueChange={(value) => setSelectedCloserId(value === "mine" ? null : value)}
            >
              <SelectTrigger className="w-[220px]">
                <User className="w-4 h-4 mr-2 text-muted-foreground" />
                <SelectValue placeholder="Selecione um closer" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="mine">Meus clientes</SelectItem>
                {closers.map((closer) => (
                  <SelectItem key={closer.user_id} value={closer.user_id}>
                    {closer.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, email ou empresa..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          
          {/* Tag Filter */}
          <div className="flex items-center gap-2">
            <Select
              value={selectedTagId || "all"}
              onValueChange={(value) => setSelectedTagId(value === "all" ? null : value)}
            >
              <SelectTrigger className="w-[180px]">
                <Tag className="w-4 h-4 mr-2 text-muted-foreground" />
                <SelectValue placeholder="Filtrar por tag" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as tags</SelectItem>
                {tags.map((tag) => (
                  <SelectItem key={tag.id} value={tag.id}>
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-3 h-3 rounded-full" 
                        style={{ backgroundColor: tag.color }}
                      />
                      {tag.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {selectedTag && (
              <Badge 
                variant="secondary" 
                className="gap-1 cursor-pointer hover:bg-secondary/80"
                onClick={() => setSelectedTagId(null)}
              >
                <div 
                  className="w-2 h-2 rounded-full" 
                  style={{ backgroundColor: selectedTag.color }}
                />
                {selectedTag.name}
                <X className="w-3 h-3" />
              </Badge>
            )}
          </div>
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
