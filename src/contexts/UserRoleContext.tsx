import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { UserRole } from '@/types';

interface UserRoleContextType {
  role: UserRole | null;
  isAdmin: boolean;
  isLeader: boolean;
  loading: boolean;
}

const UserRoleContext = createContext<UserRoleContextType | undefined>(undefined);

export function UserRoleProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const [role, setRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLeader, setIsLeader] = useState(false);
  const [lastFetchedUserId, setLastFetchedUserId] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;

    if (user && user.id !== lastFetchedUserId) {
      setLastFetchedUserId(user.id);
      fetchRole();
    } else if (!user) {
      setLastFetchedUserId(null);
      setRole(null);
      setIsAdmin(false);
      setIsLeader(false);
      setLoading(false);
    }
  }, [user?.id, authLoading]);

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

  return (
    <UserRoleContext.Provider value={{ role, isAdmin, isLeader, loading }}>
      {children}
    </UserRoleContext.Provider>
  );
}

export function useUserRoleContext() {
  const context = useContext(UserRoleContext);
  if (context === undefined) {
    throw new Error('useUserRoleContext must be used within a UserRoleProvider');
  }
  return context;
}
