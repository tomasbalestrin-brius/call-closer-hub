import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';
import type { PortfolioStudent, TicketUpgrade, StudentActivity, PortfolioMetrics, TicketType, StudentActivityType } from '@/types';

export function usePortfolioStudents() {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['portfolio-students', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('portfolio_students')
        .select('*')
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
        .select('*')
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
        .select('*')
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
        .select('*')
        .not('student_id', 'is', null);
      
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });
}

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
