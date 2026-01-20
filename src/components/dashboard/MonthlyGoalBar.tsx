import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Flag } from 'lucide-react';
import { startOfMonth, endOfMonth, format } from 'date-fns';

export default function MonthlyGoalBar() {
  const { user } = useAuth();
  const [currentValue, setCurrentValue] = useState(0);
  const [goalValue, setGoalValue] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchMonthlyData();
    }
  }, [user]);

  const fetchMonthlyData = async () => {
    if (!user) return;

    try {
      const now = new Date();
      const currentMonth = now.getMonth() + 1;
      const currentYear = now.getFullYear();
      const monthStart = format(startOfMonth(now), 'yyyy-MM-dd');
      const monthEnd = format(endOfMonth(now), 'yyyy-MM-dd') + 'T23:59:59';

      // Fetch goal and sales in parallel
      const [goalResult, salesResult] = await Promise.all([
        supabase
          .from('monthly_goals')
          .select('goal_value')
          .eq('closer_id', user.id)
          .eq('month', currentMonth)
          .eq('year', currentYear)
          .maybeSingle(),
        supabase
          .from('clients')
          .select('sale_value')
          .eq('closer_id', user.id)
          .eq('is_sold', true)
          .gte('sold_at', monthStart)
          .lte('sold_at', monthEnd)
      ]);

      if (goalResult.error) throw goalResult.error;
      if (salesResult.error) throw salesResult.error;

      if (goalResult.data) {
        setGoalValue(Number(goalResult.data.goal_value));
      }

      const total = (salesResult.data || []).reduce(
        (acc, client) => acc + (Number(client.sale_value) || 0), 
        0
      );
      setCurrentValue(total);
    } catch (error) {
      console.error('Error fetching monthly data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  if (goalValue === null) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Flag className="w-4 h-4 text-muted-foreground" />
            Meta Mensal
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Meta não definida pelo líder
          </p>
        </CardContent>
      </Card>
    );
  }

  const percentage = Math.min((currentValue / goalValue) * 100, 100);
  const remaining = Math.max(goalValue - currentValue, 0);

  const getProgressColor = () => {
    if (percentage >= 100) return 'bg-emerald-500';
    if (percentage >= 80) return 'bg-orange-500';
    if (percentage >= 50) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Flag className="w-4 h-4 text-muted-foreground" />
          Meta Mensal
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">
            {formatCurrency(currentValue)} de {formatCurrency(goalValue)}
          </span>
          <span className="font-semibold">{Math.round(percentage)}%</span>
        </div>
        <div className="relative">
          <Progress value={percentage} className="h-3" />
          <div 
            className={`absolute top-0 left-0 h-full rounded-full transition-all ${getProgressColor()}`}
            style={{ width: `${percentage}%` }}
          />
        </div>
        {remaining > 0 && (
          <p className="text-xs text-muted-foreground">
            Faltam {formatCurrency(remaining)} para a meta
          </p>
        )}
        {percentage >= 100 && (
          <p className="text-xs text-emerald-500 font-medium">
            🏆 Meta atingida!
          </p>
        )}
      </CardContent>
    </Card>
  );
}
