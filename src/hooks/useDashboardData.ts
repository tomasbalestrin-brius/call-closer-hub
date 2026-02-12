import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { startOfMonth, endOfMonth, format } from 'date-fns';

interface DashboardConsolidatedData {
  monthlySales: {
    totalEntry: number;
    totalSale: number;
    closerCount: number;
  };
  monthlyGoal: number | null;
}

export function useDashboardData() {
  const { user } = useAuth();
  const { isAdmin, isFinanceiro, loading: roleLoading } = useUserRole();

  return useQuery({
    queryKey: ['dashboard-consolidated', user?.id, isAdmin, isFinanceiro],
    queryFn: async (): Promise<DashboardConsolidatedData> => {
      if (!user) throw new Error('No user');

      const now = new Date();
      const monthStart = format(startOfMonth(now), 'yyyy-MM-dd');
      const monthEnd = format(endOfMonth(now), 'yyyy-MM-dd') + 'T23:59:59';
      const currentMonth = now.getMonth() + 1;
      const currentYear = now.getFullYear();

      // Build all queries
      let salesQuery = supabase
        .from('clients')
        .select('entry_value, sale_value')
        .eq('is_sold', true)
        .gte('sold_at', monthStart)
        .lte('sold_at', monthEnd);

      const canSeeAll = isAdmin || isFinanceiro;
      if (!canSeeAll) {
        salesQuery = salesQuery.eq('closer_id', user.id);
      }

      let goalsQuery = supabase
        .from('monthly_goals')
        .select('goal_value, closer_id')
        .eq('month', currentMonth)
        .eq('year', currentYear);

      if (!canSeeAll) {
        goalsQuery = goalsQuery.eq('closer_id', user.id);
      }

      const closerCountPromise = canSeeAll
        ? supabase.from('user_roles').select('id').eq('role', 'closer')
        : Promise.resolve({ data: null, error: null });

      const [salesResult, goalsResult, closerResult] = await Promise.all([
        salesQuery,
        goalsQuery,
        closerCountPromise,
      ]);

      if (salesResult.error) throw salesResult.error;
      if (goalsResult.error) throw goalsResult.error;

      const totalEntry = (salesResult.data || []).reduce((acc, c) => acc + (Number(c.entry_value) || 0), 0);
      const totalSale = (salesResult.data || []).reduce((acc, c) => acc + (Number(c.sale_value) || 0), 0);
      const closerCount = closerResult.data?.length || 1;

      // Calculate goal
      let monthlyGoal: number | null = null;
      if (goalsResult.data && goalsResult.data.length > 0) {
        if (canSeeAll) {
          monthlyGoal = goalsResult.data.reduce((acc, g) => acc + Number(g.goal_value), 0);
        } else {
          monthlyGoal = Number(goalsResult.data[0].goal_value);
        }
      }

      return {
        monthlySales: { totalEntry, totalSale, closerCount },
        monthlyGoal,
      };
    },
    staleTime: 60_000,
    enabled: !!user && !roleLoading,
    placeholderData: (prev) => prev,
  });
}
