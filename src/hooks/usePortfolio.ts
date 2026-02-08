import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';
import type { PortfolioStudent, TicketUpgrade, StudentActivity, PortfolioMetrics, TicketType, StudentActivityType, Client, Call } from '@/types';

export interface EnrichedStudentData {
  clientId: string;
  revenue: number | null;
  productOffered: string | null;
  niche: string | null;
  hasIntensivo: boolean;
  hasMentoria: boolean;
  indicationsCount: number;
}

export function useStudentEnrichedData(students: PortfolioStudent[]) {
  const clientIds = students.map(s => s.client_id).filter(Boolean) as string[];
  
  const { data, isLoading } = useQuery({
    queryKey: ['enriched-data', clientIds],
    queryFn: async () => {
      if (clientIds.length === 0) return { clients: [], activities: [], indications: [] };
      const [clientsResult, activitiesResult, indicationsResult] = await Promise.all([
        supabase.from('clients').select('id, revenue, product_offered, niche').in('id', clientIds),
        supabase.from('client_activities').select('client_id, activity_type').in('client_id', clientIds).in('activity_type', ['intensivo', 'mentoria']),
        supabase.from('indications').select('client_id').in('client_id', clientIds),
      ]);
      return {
        clients: clientsResult.data || [],
        activities: activitiesResult.data || [],
        indications: indicationsResult.data || [],
      };
    },
    enabled: clientIds.length > 0,
    staleTime: 120_000,
  });

  const enrichedDataMap = new Map<string, EnrichedStudentData>();
  
  if (data?.clients) {
    data.clients.forEach(client => {
      enrichedDataMap.set(client.id, {
        clientId: client.id,
        revenue: client.revenue,
        productOffered: client.product_offered,
        niche: client.niche,
        hasIntensivo: false,
        hasMentoria: false,
        indicationsCount: 0,
      });
    });
  }

  if (data?.activities) {
    data.activities.forEach(activity => {
      const d = enrichedDataMap.get(activity.client_id);
      if (d) {
        if (activity.activity_type === 'intensivo') d.hasIntensivo = true;
        else if (activity.activity_type === 'mentoria') d.hasMentoria = true;
      }
    });
  }

  if (data?.indications) {
    data.indications.forEach(indication => {
      if (indication.client_id) {
        const d = enrichedDataMap.get(indication.client_id);
        if (d) d.indicationsCount += 1;
      }
    });
  }

  return { enrichedDataMap, isLoading };
}

export function usePortfolioStudents() {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['portfolio-students', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('portfolio_students')
        .select('id, client_id, closer_id, name, phone, email, niche, notes, current_ticket, entry_date, created_at, updated_at')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as PortfolioStudent[];
    },
    enabled: !!user,
  });
}

export function useTicketUpgrades() {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['ticket-upgrades', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ticket_upgrades')
        .select('id, student_id, from_ticket, to_ticket, upgrade_date, sale_value, entry_value, notes, created_at')
        .order('upgrade_date', { ascending: false });
      
      if (error) throw error;
      return data as TicketUpgrade[];
    },
    enabled: !!user,
  });
}

export function useStudentActivities() {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['student-activities', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('student_activities')
        .select('id, student_id, activity_type, activity_name, activity_date, notes, created_at')
        .order('activity_date', { ascending: false });
      
      if (error) throw error;
      return data as StudentActivity[];
    },
    enabled: !!user,
  });
}

export function useStudentIndications() {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['student-indications', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('indications')
        .select('id, student_id, client_id, indicated_by, indicated_name, indicated_phone, indication_type, status, notes, created_at, updated_at')
        .not('student_id', 'is', null);
      
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });
}

// Consolidated hook for all portfolio metrics data (replaces 3 separate hooks)
export function useAllPortfolioData() {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['all-portfolio-data', user?.id],
    queryFn: async () => {
      const [clientsResult, activitiesResult, indicationsResult] = await Promise.all([
        supabase.from('clients').select('id, is_sold, sale_value, closer_id'),
        supabase.from('client_activities').select('id, client_id, activity_type'),
        supabase.from('indications').select('id, client_id, indication_type, status, student_id'),
      ]);
      if (clientsResult.error) throw clientsResult.error;
      if (activitiesResult.error) throw activitiesResult.error;
      if (indicationsResult.error) throw indicationsResult.error;
      return {
        clients: clientsResult.data,
        activities: activitiesResult.data,
        indications: indicationsResult.data,
      };
    },
    enabled: !!user,
    staleTime: 120_000,
  });
}

// Keep legacy hooks for backward compatibility
export function useAllClients() {
  const { data } = useAllPortfolioData();
  return { data: data?.clients };
}

export function useAllClientActivities() {
  const { data } = useAllPortfolioData();
  return { data: data?.activities };
}

export function useAllIndications() {
  const { data } = useAllPortfolioData();
  return { data: data?.indications };
}

// Métricas baseadas em TODOS os clientes (para o dashboard da carteira)
export function useClientsMetrics() {
  const { data: clients } = useAllClients();
  const { data: activities } = useAllClientActivities();
  const { data: indications } = useAllIndications();
  const { data: upgrades } = useTicketUpgrades();
  
  // Contagem por ticket baseado em vendas
  const clientsByTicket = {
    '29_90': clients?.filter(c => !c.is_sold || (c.sale_value && c.sale_value < 5000)).length || 0,
    '12k': clients?.filter(c => c.is_sold && c.sale_value && c.sale_value >= 5000 && c.sale_value < 50000).length || 0,
    '80k': clients?.filter(c => c.is_sold && c.sale_value && c.sale_value >= 50000).length || 0,
  };
  
  // Contagem de atividades
  const totalIntensivos = activities?.filter(a => a.activity_type === 'intensivo').length || 0;
  const totalMentorias = activities?.filter(a => a.activity_type === 'mentoria').length || 0;
  const totalEventos = activities?.filter(a => a.activity_type === 'evento').length || 0;
  
  // Indicações por tipo
  const indicacoesCall = indications?.filter(i => i.indication_type === 'call').length || 0;
  const indicacoesIntensivo = indications?.filter(i => i.indication_type === 'intensivo').length || 0;
  const totalIndicacoes = indications?.length || 0;
  
  // Fechadas (status = 'convertido') por tipo
  const indicacoesFechadasCall = indications?.filter(i => 
    i.indication_type === 'call' && i.status === 'convertido'
  ).length || 0;
  
  const indicacoesFechadasIntensivo = indications?.filter(i => 
    i.indication_type === 'intensivo' && i.status === 'convertido'
  ).length || 0;
  
  // Taxas de conversão de indicações
  const taxaConversaoCall = indicacoesCall > 0 
    ? (indicacoesFechadasCall / indicacoesCall) * 100 : 0;
  const taxaConversaoIntensivo = indicacoesIntensivo > 0 
    ? (indicacoesFechadasIntensivo / indicacoesIntensivo) * 100 : 0;
  const taxaConversaoGeral = totalIndicacoes > 0 
    ? ((indicacoesFechadasCall + indicacoesFechadasIntensivo) / totalIndicacoes) * 100 : 0;
  
  // Taxas de ascensão baseadas em vendas reais
  const totalClients = clients?.length || 0;
  const clientsSold12k = clientsByTicket['12k'];
  const clientsSold80k = clientsByTicket['80k'];
  
  // Taxa 29,90 → 12K: % de clientes que compraram 12k
  const ascensionRate29to12k = totalClients > 0 
    ? ((clientsSold12k + clientsSold80k) / totalClients) * 100 : 0;
  
  // Taxa 12K → 80K: baseado em upgrades registrados
  const upgradesFrom12k = upgrades?.filter(u => u.from_ticket === '12k' && u.to_ticket === '80k').length || 0;
  const total12kBase = clientsSold12k + upgradesFrom12k;
  const ascensionRate12kto80k = total12kBase > 0 ? (upgradesFrom12k / total12kBase) * 100 : 0;
  
  const metrics: PortfolioMetrics = {
    totalStudents: totalClients,
    studentsByTicket: clientsByTicket,
    ascensionRate29to12k,
    ascensionRate12kto80k,
    totalAscensions: upgrades?.length || 0,
    totalIntensivos,
    totalMentorias,
    totalEventos,
    totalIndicacoes,
    indicacoesCall,
    indicacoesIntensivo,
    indicacoesFechadasCall,
    indicacoesFechadasIntensivo,
    taxaConversaoCall,
    taxaConversaoIntensivo,
    taxaConversaoGeral,
  };
  
  return metrics;
}

// Métricas originais baseadas apenas em portfolio_students (mantido para compatibilidade)
export function usePortfolioMetrics() {
  const { data: students } = usePortfolioStudents();
  const { data: upgrades } = useTicketUpgrades();
  const { data: activities } = useStudentActivities();
  const { data: indications } = useStudentIndications();
  
  // Indicações por tipo
  const indicacoesCall = indications?.filter(i => i.indication_type === 'call').length || 0;
  const indicacoesIntensivo = indications?.filter(i => i.indication_type === 'intensivo').length || 0;
  const totalIndicacoes = indications?.length || 0;
  
  // Fechadas (status = 'convertido') por tipo
  const indicacoesFechadasCall = indications?.filter(i => 
    i.indication_type === 'call' && i.status === 'convertido'
  ).length || 0;
  
  const indicacoesFechadasIntensivo = indications?.filter(i => 
    i.indication_type === 'intensivo' && i.status === 'convertido'
  ).length || 0;
  
  // Taxas de conversão
  const taxaConversaoCall = indicacoesCall > 0 
    ? (indicacoesFechadasCall / indicacoesCall) * 100 : 0;
  const taxaConversaoIntensivo = indicacoesIntensivo > 0 
    ? (indicacoesFechadasIntensivo / indicacoesIntensivo) * 100 : 0;
  const taxaConversaoGeral = totalIndicacoes > 0 
    ? ((indicacoesFechadasCall + indicacoesFechadasIntensivo) / totalIndicacoes) * 100 : 0;
  
  const metrics: PortfolioMetrics = {
    totalStudents: students?.length || 0,
    studentsByTicket: {
      '29_90': students?.filter(s => s.current_ticket === '29_90').length || 0,
      '12k': students?.filter(s => s.current_ticket === '12k').length || 0,
      '80k': students?.filter(s => s.current_ticket === '80k').length || 0,
    },
    ascensionRate29to12k: 0,
    ascensionRate12kto80k: 0,
    totalAscensions: upgrades?.length || 0,
    totalIntensivos: activities?.filter(a => a.activity_type === 'intensivo').length || 0,
    totalMentorias: activities?.filter(a => a.activity_type === 'mentoria').length || 0,
    totalEventos: activities?.filter(a => a.activity_type === 'evento').length || 0,
    // Indicações detalhadas
    totalIndicacoes,
    indicacoesCall,
    indicacoesIntensivo,
    indicacoesFechadasCall,
    indicacoesFechadasIntensivo,
    taxaConversaoCall,
    taxaConversaoIntensivo,
    taxaConversaoGeral,
  };
  
  // Calculate ascension rates
  if (students && upgrades) {
    const upgradesFrom29 = upgrades.filter(u => u.from_ticket === '29_90' && u.to_ticket === '12k').length;
    const studentsIn29orWere = students.filter(s => s.current_ticket === '29_90').length + upgradesFrom29;
    metrics.ascensionRate29to12k = studentsIn29orWere > 0 ? (upgradesFrom29 / studentsIn29orWere) * 100 : 0;
    
    const upgradesFrom12k = upgrades.filter(u => u.from_ticket === '12k' && u.to_ticket === '80k').length;
    const studentsIn12korWere = students.filter(s => s.current_ticket === '12k').length + upgradesFrom12k;
    metrics.ascensionRate12kto80k = studentsIn12korWere > 0 ? (upgradesFrom12k / studentsIn12korWere) * 100 : 0;
  }
  
  return metrics;
}

export function useCreateStudent() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  return useMutation({
    mutationFn: async (student: Omit<PortfolioStudent, 'id' | 'closer_id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase
        .from('portfolio_students')
        .insert({
          ...student,
          closer_id: user!.id,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portfolio-students'] });
      toast.success('Aluno adicionado com sucesso!');
    },
    onError: (error) => {
      toast.error('Erro ao adicionar aluno: ' + error.message);
    },
  });
}

export function useUpdateStudent() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<PortfolioStudent> & { id: string }) => {
      const { data, error } = await supabase
        .from('portfolio_students')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portfolio-students'] });
      toast.success('Aluno atualizado com sucesso!');
    },
    onError: (error) => {
      toast.error('Erro ao atualizar aluno: ' + error.message);
    },
  });
}

export function useDeleteStudent() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('portfolio_students')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portfolio-students'] });
      toast.success('Aluno removido com sucesso!');
    },
    onError: (error) => {
      toast.error('Erro ao remover aluno: ' + error.message);
    },
  });
}

export function useCreateUpgrade() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (upgrade: Omit<TicketUpgrade, 'id' | 'created_at'> & { studentId: string; newTicket: TicketType }) => {
      // First, update the student's current ticket
      const { error: updateError } = await supabase
        .from('portfolio_students')
        .update({ current_ticket: upgrade.newTicket })
        .eq('id', upgrade.studentId);
      
      if (updateError) throw updateError;
      
      // Then create the upgrade record
      const { data, error } = await supabase
        .from('ticket_upgrades')
        .insert({
          student_id: upgrade.student_id,
          from_ticket: upgrade.from_ticket,
          to_ticket: upgrade.to_ticket,
          upgrade_date: upgrade.upgrade_date,
          sale_value: upgrade.sale_value,
          entry_value: upgrade.entry_value,
          notes: upgrade.notes,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portfolio-students'] });
      queryClient.invalidateQueries({ queryKey: ['ticket-upgrades'] });
      toast.success('Ascensão registrada com sucesso!');
    },
    onError: (error) => {
      toast.error('Erro ao registrar ascensão: ' + error.message);
    },
  });
}

export function useCreateActivity() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (activity: Omit<StudentActivity, 'id' | 'created_at'>) => {
      const { data, error } = await supabase
        .from('student_activities')
        .insert(activity)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['student-activities'] });
      toast.success('Atividade registrada com sucesso!');
    },
    onError: (error) => {
      toast.error('Erro ao registrar atividade: ' + error.message);
    },
  });
}

export function useCreateStudentIndication() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  return useMutation({
    mutationFn: async (indication: {
      student_id: string;
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['student-indications'] });
      toast.success('Indicação registrada com sucesso!');
    },
    onError: (error) => {
      toast.error('Erro ao registrar indicação: ' + error.message);
    },
  });
}

// Hook para buscar dados do cliente vinculado ao aluno
export function useLinkedClient(clientId: string | null | undefined) {
  return useQuery({
    queryKey: ['linked-client', clientId],
    queryFn: async () => {
      if (!clientId) return null;
      
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .eq('id', clientId)
        .single();
      
      if (error) throw error;
      return data as Client;
    },
    enabled: !!clientId,
  });
}

// Hook para buscar calls do cliente vinculado
export function useLinkedClientCalls(clientId: string | null | undefined) {
  return useQuery({
    queryKey: ['linked-client-calls', clientId],
    queryFn: async () => {
      if (!clientId) return [];
      
      const { data, error } = await supabase
        .from('calls')
        .select('*')
        .eq('client_id', clientId)
        .order('call_date', { ascending: false });
      
      if (error) throw error;
      return data as Call[];
    },
    enabled: !!clientId,
  });
}
