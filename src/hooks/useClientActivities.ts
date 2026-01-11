import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

export interface ClientActivity {
  id: string;
  client_id: string;
  activity_type: 'intensivo' | 'mentoria';
  activity_name: string;
  activity_date: string;
  notes: string | null;
  created_at: string;
}

export function useClientActivities(clientId?: string) {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['client-activities', clientId, user?.id],
    queryFn: async () => {
      let query = supabase
        .from('client_activities')
        .select('*')
        .order('activity_date', { ascending: false });
      
      if (clientId) {
        query = query.eq('client_id', clientId);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data as ClientActivity[];
    },
    enabled: !!user,
  });
}

export function useAllClientActivities() {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['all-client-activities', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('client_activities')
        .select('*')
        .order('activity_date', { ascending: false });
      
      if (error) throw error;
      return data as ClientActivity[];
    },
    enabled: !!user,
  });
}

export function useCreateClientActivity() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (activity: Omit<ClientActivity, 'id' | 'created_at'>) => {
      const { data, error } = await supabase
        .from('client_activities')
        .insert(activity)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['client-activities', variables.client_id] });
      queryClient.invalidateQueries({ queryKey: ['all-client-activities'] });
      toast.success('Atividade registrada com sucesso!');
    },
    onError: (error) => {
      toast.error('Erro ao registrar atividade: ' + error.message);
    },
  });
}

export function useDeleteClientActivity() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, clientId }: { id: string; clientId: string }) => {
      const { error } = await supabase
        .from('client_activities')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      return clientId;
    },
    onSuccess: (clientId) => {
      queryClient.invalidateQueries({ queryKey: ['client-activities', clientId] });
      queryClient.invalidateQueries({ queryKey: ['all-client-activities'] });
      toast.success('Atividade removida com sucesso!');
    },
    onError: (error) => {
      toast.error('Erro ao remover atividade: ' + error.message);
    },
  });
}

export function useClientIndications(clientId?: string) {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['client-indications', clientId, user?.id],
    queryFn: async () => {
      let query = supabase
        .from('indications')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (clientId) {
        query = query.eq('client_id', clientId);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });
}

export function useCreateClientIndication() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  return useMutation({
    mutationFn: async (indication: {
      client_id: string;
      indicated_name: string;
      indicated_phone: string;
      indicated_email?: string;
      indication_type: 'call' | 'intensivo';
      notes?: string;
    }) => {
      const { data, error } = await supabase
        .from('indications')
        .insert({
          ...indication,
          indicated_by: user!.id,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['client-indications', variables.client_id] });
      queryClient.invalidateQueries({ queryKey: ['student-indications'] });
      toast.success('Indicação registrada com sucesso!');
    },
    onError: (error) => {
      toast.error('Erro ao registrar indicação: ' + error.message);
    },
  });
}

export function usePendingIndications() {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['pending-indications', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('indications')
        .select('*')
        .eq('status', 'pendente')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });
}

export function useUpdateIndicationStatus() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { data, error } = await supabase
        .from('indications')
        .update({ status })
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-indications'] });
      queryClient.invalidateQueries({ queryKey: ['client-indications'] });
      queryClient.invalidateQueries({ queryKey: ['student-indications'] });
    },
    onError: (error) => {
      toast.error('Erro ao atualizar indicação: ' + error.message);
    },
  });
}
