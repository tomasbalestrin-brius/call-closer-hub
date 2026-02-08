import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { startOfMonth, endOfMonth, format } from 'date-fns';

interface MonthlySalesData {
  totalEntry: number;
  totalSale: number;
  closerCount: number;
}

export function useMonthlySales() {
  const { user } = useAuth();
  const { isAdmin } = useUserRole();

  return useQuery({
    queryKey: ['monthly-sales', user?.id, isAdmin],
    queryFn: async (): Promise<MonthlySalesData> => {
      if (!user) throw new Error('No user');

      const now = new Date();
      const monthStart = format(startOfMonth(now), 'yyyy-MM-dd');
      const monthEnd = format(endOfMonth(now), 'yyyy-MM-dd') + 'T23:59:59';

      // Build sales query
      let salesQuery = supabase
        .from('clients')
        .select('entry_value, sale_value')
        .eq('is_sold', true)
        .gte('sold_at', monthStart)
        .lte('sold_at', monthEnd);

      if (!isAdmin) {
        salesQuery = salesQuery.eq('closer_id', user.id);
      }

      // Closer count only needed for admin
      const closerCountPromise = isAdmin
        ? supabase.from('user_roles').select('id').eq('role', 'closer')
        : Promise.resolve({ data: null, error: null });

      const [salesResult, closerResult] = await Promise.all([
        salesQuery,
        closerCountPromise,
      ]);

      if (salesResult.error) throw salesResult.error;

      const totalEntry = (salesResult.data || []).reduce((acc, c) => acc + (Number(c.entry_value) || 0), 0);
      const totalSale = (salesResult.data || []).reduce((acc, c) => acc + (Number(c.sale_value) || 0), 0);
      const closerCount = closerResult.data?.length || 1;

      return { totalEntry, totalSale, closerCount };
    },
    staleTime: 60_000,
    enabled: !!user,
  });
}
