import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Flame, BookOpen, CalendarCheck } from 'lucide-react';
import type { PortfolioMetrics, StudentActivityType } from '@/types';
import ActivityListDialog from './ActivityListDialog';

interface ActivityMetricsProps {
  metrics: PortfolioMetrics;
}

export default function ActivityMetrics({ metrics }: ActivityMetricsProps) {
  const [openType, setOpenType] = useState<StudentActivityType | null>(null);

  const items = [
    { type: 'intensivo' as StudentActivityType, label: 'Intensivos', value: metrics.totalIntensivos, icon: Flame, colorClass: 'bg-orange-500/10 text-orange-500' },
    { type: 'mentoria' as StudentActivityType, label: 'Mentorias', value: metrics.totalMentorias, icon: BookOpen, colorClass: 'bg-indigo-500/10 text-indigo-500' },
    { type: 'evento' as StudentActivityType, label: 'Eventos', value: metrics.totalEventos, icon: CalendarCheck, colorClass: 'bg-teal-500/10 text-teal-500' },
  ];

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {items.map(item => (
          <Card
            key={item.type}
            className="cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => setOpenType(item.type)}
          >
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${item.colorClass.split(' ')[0]}`}>
                  <item.icon className={`w-5 h-5 ${item.colorClass.split(' ')[1]}`} />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{item.value}</p>
                  <p className="text-sm text-muted-foreground">{item.label}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {openType && (
        <ActivityListDialog
          open={!!openType}
          onOpenChange={(open) => !open && setOpenType(null)}
          activityType={openType}
          title={items.find(i => i.type === openType)?.label || ''}
        />
      )}
    </>
  );
}
