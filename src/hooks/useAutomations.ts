import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { CRMAutomation, AutomationTriggerType, AutomationActionType } from '@/types';
import { toast } from 'sonner';

export function useAutomations() {
  const { user } = useAuth();
  const [automations, setAutomations] = useState<CRMAutomation[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAutomations = useCallback(async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('crm_automations')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAutomations(data as CRMAutomation[]);
    } catch (error) {
      console.error('Error fetching automations:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchAutomations();
  }, [fetchAutomations]);

  const createAutomation = async (
    name: string,
    description: string | null,
    triggerType: AutomationTriggerType,
    triggerConfig: Record<string, unknown>,
    actionType: AutomationActionType,
    actionConfig: Record<string, unknown>
  ) => {
    if (!user) return null;

    try {
      const { data, error } = await supabase
        .from('crm_automations')
        .insert([{
          user_id: user.id,
          name,
          description,
          trigger_type: triggerType,
          trigger_config: triggerConfig as any,
          action_type: actionType,
          action_config: actionConfig as any
        }])
        .select()
        .single();

      if (error) throw error;
      
      setAutomations(prev => [data as CRMAutomation, ...prev]);
      toast.success('Automação criada com sucesso!');
      return data as CRMAutomation;
    } catch (error) {
      console.error('Error creating automation:', error);
      toast.error('Erro ao criar automação');
      return null;
    }
  };

  const updateAutomation = async (id: string, updates: Partial<CRMAutomation>) => {
    try {
      const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (updates.name !== undefined) updateData.name = updates.name;
      if (updates.description !== undefined) updateData.description = updates.description;
      if (updates.is_active !== undefined) updateData.is_active = updates.is_active;
      if (updates.trigger_type !== undefined) updateData.trigger_type = updates.trigger_type;
      if (updates.trigger_config !== undefined) updateData.trigger_config = updates.trigger_config;
      if (updates.action_type !== undefined) updateData.action_type = updates.action_type;
      if (updates.action_config !== undefined) updateData.action_config = updates.action_config;

      const { error } = await supabase
        .from('crm_automations')
        .update(updateData)
        .eq('id', id);

      if (error) throw error;
      
      setAutomations(prev => prev.map(a => a.id === id ? { ...a, ...updates } : a));
      toast.success('Automação atualizada!');
      return true;
    } catch (error) {
      toast.error('Erro ao atualizar automação');
      return false;
    }
  };

  const toggleAutomation = async (id: string) => {
    const automation = automations.find(a => a.id === id);
    if (!automation) return false;

    return updateAutomation(id, { is_active: !automation.is_active });
  };

  const deleteAutomation = async (id: string) => {
    try {
      const { error } = await supabase
        .from('crm_automations')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      setAutomations(prev => prev.filter(a => a.id !== id));
      toast.success('Automação excluída!');
      return true;
    } catch (error) {
      toast.error('Erro ao excluir automação');
      return false;
    }
  };

  return {
    automations,
    loading,
    fetchAutomations,
    createAutomation,
    updateAutomation,
    toggleAutomation,
    deleteAutomation
  };
}

// Trigger type labels
export const TRIGGER_TYPE_LABELS: Record<AutomationTriggerType, string> = {
  days_in_column: 'Dias na coluna',
  followup_date_reached: 'Data de follow-up chegou',
  tag_added: 'Tag adicionada',
  data_completed: 'Dados preenchidos',
  no_interaction: 'Sem interação',
};

// Action type labels
export const ACTION_TYPE_LABELS: Record<AutomationActionType, string> = {
  move_to_column: 'Mover para coluna',
  add_tag: 'Adicionar tag',
  remove_tag: 'Remover tag',
  send_notification: 'Enviar notificação',
  mark_super_hot: 'Marcar Super Quente',
};
