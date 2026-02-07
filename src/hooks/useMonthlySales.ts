import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { startOfMonth, endOfMonth, format } from 'date-fns';

export function useMonthlySales() {
  const { user } = useAuth();
  const { isAdmin } = useUserRole();

  return useQuery({
    queryKey: ['monthly-sales', user?.id, isAdmin],
    queryFn: async () => {
      if (!user) throw new Error('No user');

      const now = new Date();
      const monthStart = format(startOfMonth(now), 'yyyy-MM-dd');
      const monthEnd = format(endOfMonth(now), 'yyyy-MM-dd') + 'T23:59:59';

      let query = supabase
        .from('clients')
        .select('entry_value, sale_value')
        .eq('is_sold', true)
        .gte('sold_at', monthStart)
        .lte('sold_at', monthEnd);

      if (!isAdmin) {
        query = query.eq('closer_id', user.id);
      }

      const { data, error } = await query;
      if (error) throw error;

      const totalEntry = (data || []).reduce((acc, c) => acc + (Number(c.entry_value) || 0), 0);
      const totalSale = (data || []).reduce((acc, c) => acc + (Number(c.sale_value) || 0), 0);

      return { totalEntry, totalSale };
    },
    staleTime: 60_000,
    enabled: !!user,
  });
}
