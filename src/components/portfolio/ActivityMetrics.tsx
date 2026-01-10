import { Card, CardContent } from '@/components/ui/card';
import { Flame, BookOpen, CalendarCheck } from 'lucide-react';
import type { PortfolioMetrics } from '@/types';

interface ActivityMetricsProps {
  metrics: PortfolioMetrics;
}

export default function ActivityMetrics({ metrics }: ActivityMetricsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-orange-500/10 flex items-center justify-center">
              <Flame className="w-5 h-5 text-orange-500" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{metrics.totalIntensivos}</p>
              <p className="text-sm text-muted-foreground">Intensivos</p>
            </div>
          </div>
        </CardContent>
      </Card>
      
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-indigo-500/10 flex items-center justify-center">
              <BookOpen className="w-5 h-5 text-indigo-500" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{metrics.totalMentorias}</p>
              <p className="text-sm text-muted-foreground">Mentorias</p>
            </div>
          </div>
        </CardContent>
      </Card>
      
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-teal-500/10 flex items-center justify-center">
              <CalendarCheck className="w-5 h-5 text-teal-500" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{metrics.totalEventos}</p>
              <p className="text-sm text-muted-foreground">Eventos</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
