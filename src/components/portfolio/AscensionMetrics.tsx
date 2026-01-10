import { Card, CardContent } from '@/components/ui/card';
import { TrendingUp, ArrowUpRight, Target } from 'lucide-react';
import type { PortfolioMetrics } from '@/types';

interface AscensionMetricsProps {
  metrics: PortfolioMetrics;
}

export default function AscensionMetrics({ metrics }: AscensionMetricsProps) {
  const generalRate = metrics.totalStudents > 0 
    ? ((metrics.ascensionRate29to12k + metrics.ascensionRate12kto80k) / 2)
    : 0;
  
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-500/20">
        <CardContent className="p-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">29,90 → 12K</p>
              <p className="text-3xl font-bold text-foreground mt-2">
                {metrics.ascensionRate29to12k.toFixed(1)}%
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Taxa de ascensão
              </p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-blue-500" />
            </div>
          </div>
        </CardContent>
      </Card>
      
      <Card className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border-purple-500/20">
        <CardContent className="p-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">12K → 80K</p>
              <p className="text-3xl font-bold text-foreground mt-2">
                {metrics.ascensionRate12kto80k.toFixed(1)}%
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Taxa de ascensão
              </p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center">
              <ArrowUpRight className="w-6 h-6 text-purple-500" />
            </div>
          </div>
        </CardContent>
      </Card>
      
      <Card className="bg-gradient-to-br from-green-500/10 to-green-600/5 border-green-500/20">
        <CardContent className="p-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Taxa Geral</p>
              <p className="text-3xl font-bold text-foreground mt-2">
                {generalRate.toFixed(1)}%
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {metrics.totalAscensions} ascensões totais
              </p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-green-500/20 flex items-center justify-center">
              <Target className="w-6 h-6 text-green-500" />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
