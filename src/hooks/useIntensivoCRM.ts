import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useUserRole } from './useUserRole';
import { toast } from 'sonner';
import type { IntensiveEdition, IntensiveLead, IntensiveLeadStatus } from '@/types/intensivo';

export function useIntensivoCRM(editionId?: string) {
  const { user } = useAuth();
  const { isAdmin } = useUserRole();
  const queryClient = useQueryClient();

  // Fetch editions
  const { data: editions = [], isLoading: loadingEditions, isError: editionsError } = useQuery({
    queryKey: ['intensive-editions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('intensive_editions')
        .select('*')
        .order('event_date', { ascending: false });
      
      if (error) throw error;
      return data as IntensiveEdition[];
    },
    enabled: !!user,
    retry: 2,
  });

  // Fetch leads for selected edition
  const { data: leads = [], isLoading: loadingLeads, isError: leadsError } = useQuery({
    queryKey: ['intensive-leads', editionId],
    queryFn: async () => {
      if (!editionId) return [];
      
      const { data, error } = await supabase
        .from('intensive_leads')
        .select('*')
        .eq('edition_id', editionId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as IntensiveLead[];
    },
    enabled: !!user && !!editionId,
    retry: 2,
  });

  // Create edition mutation
  const createEdition = useMutation({
    mutationFn: async (edition: Omit<IntensiveEdition, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase
        .from('intensive_editions')
        .insert(edition)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['intensive-editions'] });
      toast.success('Edição criada com sucesso!');
    },
    onError: (error) => {
      console.error('Error creating edition:', error);
      toast.error('Erro ao criar edição');
    },
  });

  // Update edition mutation
  const updateEdition = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<IntensiveEdition> & { id: string }) => {
      const { data, error } = await supabase
        .from('intensive_editions')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['intensive-editions'] });
      toast.success('Edição atualizada!');
    },
    onError: (error) => {
      console.error('Error updating edition:', error);
      toast.error('Erro ao atualizar edição');
    },
  });

  // Delete edition mutation
  const deleteEdition = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('intensive_editions')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['intensive-editions'] });
      toast.success('Edição excluída!');
    },
    onError: (error) => {
      console.error('Error deleting edition:', error);
      toast.error('Erro ao excluir edição');
    },
  });

  // Create lead mutation
  const createLead = useMutation({
    mutationFn: async (lead: Omit<IntensiveLead, 'id' | 'created_at' | 'updated_at' | 'status_changed_at'>) => {
      const { data, error } = await supabase
        .from('intensive_leads')
        .insert(lead)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['intensive-leads', editionId] });
      toast.success('Lead adicionado com sucesso!');
    },
    onError: (error) => {
      console.error('Error creating lead:', error);
      toast.error('Erro ao adicionar lead');
    },
  });

  // Update lead mutation
  const updateLead = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<IntensiveLead> & { id: string }) => {
      const { data, error } = await supabase
        .from('intensive_leads')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['intensive-leads', editionId] });
    },
    onError: (error) => {
      console.error('Error updating lead:', error);
      toast.error('Erro ao atualizar lead');
    },
  });

  // Move lead to new status
  const moveLeadStatus = useMutation({
    mutationFn: async ({ leadId, newStatus }: { leadId: string; newStatus: IntensiveLeadStatus }) => {
      const updates: Partial<IntensiveLead> = { status: newStatus };
      
      // Define status order for comparison
      const statusOrder: IntensiveLeadStatus[] = [
        'abordagem_inicial',
        'nivel_consciencia', 
        'convite_intensivo',
        'aguardando_confirmacao',
        'confirmados',
        'ingresso_retirado',
        'aquecimento_30d',
        'aquecimento_15d',
        'aquecimento_7d',
        'aquecimento_1d',
        'compareceram',
        'nao_compareceram',
        'sem_interesse',
        'proximo_intensivo'
      ];
      
      const confirmadosIndex = statusOrder.indexOf('confirmados');
      const ingressoIndex = statusOrder.indexOf('ingresso_retirado');
      const newStatusIndex = statusOrder.indexOf(newStatus);
      
      // Add timestamp based on status
      if (newStatus === 'confirmados') {
        updates.confirmed_at = new Date().toISOString();
      } else if (newStatus === 'ingresso_retirado') {
        updates.ticket_retrieved_at = new Date().toISOString();
      } else if (newStatus === 'compareceram') {
        updates.attended_at = new Date().toISOString();
      }
      
      // Clear timestamps when moving backwards
      if (newStatusIndex < confirmadosIndex) {
        // Moving to before confirmados - clear confirmed_at
        updates.confirmed_at = null;
      }
      if (newStatusIndex < ingressoIndex) {
        // Moving to before ingresso_retirado - clear ticket_retrieved_at  
        updates.ticket_retrieved_at = null;
      }
      
      const { data, error } = await supabase
        .from('intensive_leads')
        .update(updates)
        .eq('id', leadId)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['intensive-leads', editionId] });
    },
    onError: (error) => {
      console.error('Error moving lead:', error);
      toast.error('Erro ao mover lead');
    },
  });

  // Delete lead mutation
  const deleteLead = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('intensive_leads')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['intensive-leads', editionId] });
      toast.success('Lead excluído!');
    },
    onError: (error) => {
      console.error('Error deleting lead:', error);
      toast.error('Erro ao excluir lead');
    },
  });

  return {
    editions,
    leads,
    loadingEditions,
    loadingLeads,
    editionsError,
    leadsError,
    createEdition,
    updateEdition,
    deleteEdition,
    createLead,
    updateLead,
    moveLeadStatus,
    deleteLead,
    isAdmin,
  };
}
