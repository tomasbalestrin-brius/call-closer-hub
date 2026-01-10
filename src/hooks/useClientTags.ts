import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { ClientTag, ClientTagAssignment } from '@/types';
import { toast } from 'sonner';

export function useClientTags() {
  const { user } = useAuth();
  const [tags, setTags] = useState<ClientTag[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTags = useCallback(async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('client_tags')
        .select('*')
        .eq('user_id', user.id)
        .order('name');

      if (error) throw error;
      setTags(data as ClientTag[]);
    } catch (error) {
      console.error('Error fetching tags:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchTags();
  }, [fetchTags]);

  const createTag = async (name: string, color: string, icon: string = 'tag') => {
    if (!user) return null;

    try {
      const { data, error } = await supabase
        .from('client_tags')
        .insert({ user_id: user.id, name, color, icon })
        .select()
        .single();

      if (error) throw error;
      
      setTags(prev => [...prev, data as ClientTag]);
      toast.success('Tag criada com sucesso!');
      return data as ClientTag;
    } catch (error: any) {
      if (error.code === '23505') {
        toast.error('Já existe uma tag com esse nome');
      } else {
        toast.error('Erro ao criar tag');
      }
      return null;
    }
  };

  const updateTag = async (id: string, updates: Partial<ClientTag>) => {
    try {
      const { error } = await supabase
        .from('client_tags')
        .update(updates)
        .eq('id', id);

      if (error) throw error;
      
      setTags(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
      toast.success('Tag atualizada!');
      return true;
    } catch (error) {
      toast.error('Erro ao atualizar tag');
      return false;
    }
  };

  const deleteTag = async (id: string) => {
    try {
      const { error } = await supabase
        .from('client_tags')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      setTags(prev => prev.filter(t => t.id !== id));
      toast.success('Tag excluída!');
      return true;
    } catch (error) {
      toast.error('Erro ao excluir tag');
      return false;
    }
  };

  return {
    tags,
    loading,
    fetchTags,
    createTag,
    updateTag,
    deleteTag
  };
}

export function useClientTagAssignments(clientId: string) {
  const [assignments, setAssignments] = useState<ClientTagAssignment[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAssignments = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('client_tag_assignments')
        .select('*')
        .eq('client_id', clientId);

      if (error) throw error;
      setAssignments(data as ClientTagAssignment[]);
    } catch (error) {
      console.error('Error fetching tag assignments:', error);
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    if (clientId) {
      fetchAssignments();
    }
  }, [clientId, fetchAssignments]);

  const addTag = async (tagId: string) => {
    try {
      const { data, error } = await supabase
        .from('client_tag_assignments')
        .insert({ client_id: clientId, tag_id: tagId })
        .select()
        .single();

      if (error) throw error;
      
      setAssignments(prev => [...prev, data as ClientTagAssignment]);
      return true;
    } catch (error: any) {
      if (error.code === '23505') {
        toast.error('Tag já adicionada');
      } else {
        toast.error('Erro ao adicionar tag');
      }
      return false;
    }
  };

  const removeTag = async (tagId: string) => {
    try {
      const { error } = await supabase
        .from('client_tag_assignments')
        .delete()
        .eq('client_id', clientId)
        .eq('tag_id', tagId);

      if (error) throw error;
      
      setAssignments(prev => prev.filter(a => a.tag_id !== tagId));
      return true;
    } catch (error) {
      toast.error('Erro ao remover tag');
      return false;
    }
  };

  const toggleTag = async (tagId: string) => {
    const hasTag = assignments.some(a => a.tag_id === tagId);
    if (hasTag) {
      return removeTag(tagId);
    } else {
      return addTag(tagId);
    }
  };

  return {
    assignments,
    loading,
    fetchAssignments,
    addTag,
    removeTag,
    toggleTag,
    hasTag: (tagId: string) => assignments.some(a => a.tag_id === tagId)
  };
}
