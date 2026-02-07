import { useMonthlySales } from '@/hooks/useMonthlySales';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Target } from 'lucide-react';

const QUOTA_VALUE = 80000;

export default function QuotaProgressBar() {
  const { data, isLoading } = useMonthlySales();
  const currentValue = data?.totalEntry ?? 0;

  const percentage = Math.min((currentValue / QUOTA_VALUE) * 100, 100);
  const remaining = Math.max(QUOTA_VALUE - currentValue, 0);

  const getProgressColor = () => {
    if (percentage >= 100) return 'bg-emerald-500';
    if (percentage >= 80) return 'bg-orange-500';
    if (percentage >= 50) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Target className="w-4 h-4 text-muted-foreground" />
          Cota Mínima
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">
            {formatCurrency(currentValue)} de {formatCurrency(QUOTA_VALUE)}
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
            Faltam {formatCurrency(remaining)} para atingir a cota
          </p>
        )}
        {percentage >= 100 && (
          <p className="text-xs text-emerald-500 font-medium">
            🎉 Cota atingida!
          </p>
        )}
      </CardContent>
    </Card>
  );
}
