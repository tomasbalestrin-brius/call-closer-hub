import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { CRMColumnSettings } from '@/types';
import { toast } from 'sonner';

export function useColumnSettings() {
  const { user } = useAuth();
  const [settings, setSettings] = useState<CRMColumnSettings[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSettings = useCallback(async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('crm_column_settings')
        .select('*')
        .eq('user_id', user.id);

      if (error) throw error;
      setSettings(data as CRMColumnSettings[]);
    } catch (error) {
      console.error('Error fetching column settings:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const getColumnSettings = useCallback((columnId: string): CRMColumnSettings | undefined => {
    return settings.find(s => s.column_id === columnId);
  }, [settings]);

  const updateColumnSettings = async (
    columnId: string, 
    updates: { custom_title?: string | null; custom_subtitle?: string | null; custom_color?: string | null }
  ) => {
    if (!user) return false;

    try {
      const existingSettings = settings.find(s => s.column_id === columnId);
      
      if (existingSettings) {
        const { error } = await supabase
          .from('crm_column_settings')
          .update({ ...updates, updated_at: new Date().toISOString() })
          .eq('id', existingSettings.id);

        if (error) throw error;
        
        setSettings(prev => prev.map(s => 
          s.column_id === columnId ? { ...s, ...updates } : s
        ));
      } else {
        const { data, error } = await supabase
          .from('crm_column_settings')
          .insert({ user_id: user.id, column_id: columnId, ...updates })
          .select()
          .single();

        if (error) throw error;
        
        setSettings(prev => [...prev, data as CRMColumnSettings]);
      }

      toast.success('Configurações salvas!');
      return true;
    } catch (error) {
      console.error('Error updating column settings:', error);
      toast.error('Erro ao salvar configurações');
      return false;
    }
  };

  const resetColumnSettings = async (columnId: string) => {
    try {
      const existingSettings = settings.find(s => s.column_id === columnId);
      
      if (existingSettings) {
        const { error } = await supabase
          .from('crm_column_settings')
          .delete()
          .eq('id', existingSettings.id);

        if (error) throw error;
        
        setSettings(prev => prev.filter(s => s.column_id !== columnId));
        toast.success('Configurações restauradas!');
      }
      
      return true;
    } catch (error) {
      toast.error('Erro ao restaurar configurações');
      return false;
    }
  };

  return {
    settings,
    loading,
    fetchSettings,
    getColumnSettings,
    updateColumnSettings,
    resetColumnSettings
  };
}
