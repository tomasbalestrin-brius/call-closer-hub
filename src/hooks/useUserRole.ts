import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { UserRole } from '@/types';

export function useUserRole() {
  const { user } = useAuth();
  const [role, setRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (user) {
      fetchRole();
    } else {
      setRole(null);
      setIsAdmin(false);
      setLoading(false);
    }
  }, [user]);

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
    } catch (error) {
      console.error('Error fetching role:', error);
      setRole('closer');
      setIsAdmin(false);
    } finally {
      setLoading(false);
    }
  };

  return { role, isAdmin, loading };
}
