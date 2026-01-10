import { Card, CardContent } from '@/components/ui/card';
import { Coins, Gem, Crown } from 'lucide-react';
import type { PortfolioMetrics } from '@/types';

interface TicketCounterProps {
  metrics: PortfolioMetrics;
}

export default function TicketCounter({ metrics }: TicketCounterProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <Card className="border-amber-500/20 hover:border-amber-500/40 transition-colors">
        <CardContent className="p-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl bg-amber-500/10 flex items-center justify-center">
              <Coins className="w-7 h-7 text-amber-500" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Ticket 29,90</p>
              <p className="text-3xl font-bold text-foreground">
                {metrics.studentsByTicket['29_90']}
              </p>
              <p className="text-sm text-muted-foreground">alunos</p>
            </div>
          </div>
        </CardContent>
      </Card>
      
      <Card className="border-sky-500/20 hover:border-sky-500/40 transition-colors">
        <CardContent className="p-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl bg-sky-500/10 flex items-center justify-center">
              <Gem className="w-7 h-7 text-sky-500" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Ticket 12K</p>
              <p className="text-3xl font-bold text-foreground">
                {metrics.studentsByTicket['12k']}
              </p>
              <p className="text-sm text-muted-foreground">alunos</p>
            </div>
          </div>
        </CardContent>
      </Card>
      
      <Card className="border-yellow-500/20 hover:border-yellow-500/40 transition-colors">
        <CardContent className="p-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl bg-yellow-500/10 flex items-center justify-center">
              <Crown className="w-7 h-7 text-yellow-500" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Ticket 80K</p>
              <p className="text-3xl font-bold text-foreground">
                {metrics.studentsByTicket['80k']}
              </p>
              <p className="text-sm text-muted-foreground">alunos</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
