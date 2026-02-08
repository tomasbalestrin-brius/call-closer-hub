import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useUserPermissions } from '@/hooks/useUserPermissions';

interface CloserProfile {
  user_id: string;
  full_name: string;
}

export function useClosersList() {
  const { user } = useAuth();
  const { isAdmin, isLeader, loading } = useUserPermissions();

  return useQuery<CloserProfile[]>({
    queryKey: ['closers-list', user?.id, isAdmin, isLeader],
    queryFn: async () => {
      if (!user) return [];

      if (isAdmin) {
        const { data, error } = await supabase
          .from('profiles')
          .select('user_id, full_name')
          .order('full_name');
        if (error) throw error;
        return (data || []).filter(p => p.user_id !== user.id);
      } else if (isLeader) {
        const { data: squadMembers, error } = await supabase
          .from('squad_members')
          .select(`user_id, squads!inner(created_by)`)
          .eq('squads.created_by', user.id);
        if (error) throw error;
        const memberIds = (squadMembers || []).map(m => m.user_id).filter(id => id !== user.id);
        if (memberIds.length > 0) {
          const { data: profiles } = await supabase
            .from('profiles')
            .select('user_id, full_name')
            .in('user_id', memberIds)
            .order('full_name');
          return profiles || [];
        }
        return [];
      }

      return [];
    },
    enabled: !!user && !loading && (isAdmin || isLeader),
    staleTime: 120_000,
  });
}
