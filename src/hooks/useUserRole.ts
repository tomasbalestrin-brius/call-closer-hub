import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { UserRole } from '@/types';

export function useUserRole() {
  const { user, loading: authLoading } = useAuth();
  const [role, setRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLeader, setIsLeader] = useState(false);

  useEffect(() => {
    // Wait for auth to finish loading
    if (authLoading) {
      return;
    }

    if (user) {
      fetchRole();
    } else {
      setRole(null);
      setIsAdmin(false);
      setIsLeader(false);
      setLoading(false);
    }
  }, [user, authLoading]);

  const fetchRole = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;
      
      const userRole = (data?.role as UserRole) || 'closer';
      setRole(userRole);
      setIsAdmin(userRole === 'admin');
      setIsLeader(userRole === 'lider');
    } catch (error) {
      console.error('Error fetching role:', error);
      setRole('closer');
      setIsAdmin(false);
      setIsLeader(false);
    } finally {
      setLoading(false);
    }
  };

  return { role, isAdmin, isLeader, loading };
}
