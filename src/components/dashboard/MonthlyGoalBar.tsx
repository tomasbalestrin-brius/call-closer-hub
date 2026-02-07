import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { useMonthlySales } from '@/hooks/useMonthlySales';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Flag } from 'lucide-react';

export default function MonthlyGoalBar() {
  const { user } = useAuth();
  const { isAdmin } = useUserRole();
  const { data: salesData } = useMonthlySales();
  const [goalValue, setGoalValue] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const currentValue = salesData?.totalSale ?? 0;

  useEffect(() => {
    if (user) {
      fetchGoal();
    }
  }, [user]);

  const fetchGoal = async () => {
    if (!user) return;

    try {
      const now = new Date();
      let query = supabase
        .from('monthly_goals')
        .select('goal_value')
        .eq('month', now.getMonth() + 1)
        .eq('year', now.getFullYear());

      if (isAdmin) {
        // Sum all closers' goals
        const { data, error } = await query;
        if (error) throw error;
        if (data && data.length > 0) {
          const total = data.reduce((acc, g) => acc + Number(g.goal_value), 0);
          setGoalValue(total);
        }
      } else {
        const { data, error } = await query.eq('closer_id', user.id).maybeSingle();
        if (error) throw error;
        if (data) setGoalValue(Number(data.goal_value));
      }
    } catch (error) {
      console.error('Error fetching monthly goal:', error);
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
