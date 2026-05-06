import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { toast } from 'sonner';

export interface SalesPipelineCard {
  id: string;
  client_id: string;
  closer_id: string;
  name: string;
  phone: string | null;
  email: string | null;
  company: string | null;
  product_offered: string | null;
  sale_value: number | null;
  entry_value: number | null;
  sold_at: string | null;
  status: string;
  notes: string | null;
  status_changed_at: string;
  created_at: string;
  updated_at: string;
}

export const SALES_PIPELINE_COLUMNS = [
  { id: 'enviar_contrato', title: 'Enviar Contrato', color: 'bg-slate-500' },
  { id: 'contrato_enviado', title: 'Contrato Enviado', color: 'bg-blue-500' },
  { id: 'contrato_assinado', title: 'Contrato Assinado', color: 'bg-indigo-500' },
  { id: 'valor_alto_receber', title: 'Valor Alto para Receber', color: 'bg-amber-500' },
  { id: 'pedindo_indicacao', title: 'Pedindo Indicação', color: 'bg-purple-500' },
  { id: 'rede', title: 'Rede', color: 'bg-cyan-500' },
  { id: 'venda_finalizada', title: 'Venda Realizada', color: 'bg-emerald-500' },
] as const;

export type SalesPipelineStatus = (typeof SALES_PIPELINE_COLUMNS)[number]['id'];

export function useSalesPipeline() {
  const { user } = useAuth();
  const { isAdmin, isFinanceiro } = useUserRole();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ['sales-pipeline', user?.id, isAdmin || isFinanceiro],
    enabled: !!user?.id,
    queryFn: async () => {
      let q = supabase.from('sales_pipeline' as any).select('*').order('created_at', { ascending: false });
      if (!isAdmin && !isFinanceiro) {
        q = q.eq('closer_id', user!.id);
      }
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as unknown as SalesPipelineCard[];
    },
  });

  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel('sales-pipeline-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sales_pipeline' }, () => {
        qc.invalidateQueries({ queryKey: ['sales-pipeline'] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, qc]);

  const moveCard = useMutation({
    mutationFn: async ({ id, newStatus }: { id: string; newStatus: SalesPipelineStatus }) => {
      const { error } = await supabase.from('sales_pipeline' as any).update({ status: newStatus }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sales-pipeline'] });
    },
    onError: (e: any) => toast.error(e.message || 'Erro ao mover cartão'),
  });

  const deleteCard = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('sales_pipeline' as any).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Cartão removido');
      qc.invalidateQueries({ queryKey: ['sales-pipeline'] });
    },
  });

  return { ...query, moveCard, deleteCard };
}
