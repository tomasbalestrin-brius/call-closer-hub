import { Card, CardContent } from '@/components/ui/card';
import { Users, Phone, Flame } from 'lucide-react';
import type { PortfolioMetrics } from '@/types';

interface IndicationMetricsProps {
  metrics: PortfolioMetrics;
}

export default function IndicationMetrics({ metrics }: IndicationMetricsProps) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
        Indicações da Carteira
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Geradas */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-pink-500/10 flex items-center justify-center">
                <Users className="w-5 h-5 text-pink-500" />
              </div>
              <div className="flex-1">
                <p className="text-2xl font-bold text-foreground">{metrics.totalIndicacoes}</p>
                <p className="text-sm text-muted-foreground">Geradas</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {metrics.indicacoesCall} call / {metrics.indicacoesIntensivo} intensivo
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        {/* Fechadas Call */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <Phone className="w-5 h-5 text-blue-500" />
              </div>
              <div className="flex-1">
                <div className="flex items-baseline gap-2">
                  <p className="text-2xl font-bold text-foreground">{metrics.indicacoesFechadasCall}</p>
                  <span className="text-sm font-medium text-blue-500">
                    ({metrics.taxaConversaoCall.toFixed(1)}%)
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">Fechadas Call</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        {/* Fechadas Intensivo */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-orange-500/10 flex items-center justify-center">
                <Flame className="w-5 h-5 text-orange-500" />
              </div>
              <div className="flex-1">
                <div className="flex items-baseline gap-2">
                  <p className="text-2xl font-bold text-foreground">{metrics.indicacoesFechadasIntensivo}</p>
                  <span className="text-sm font-medium text-orange-500">
                    ({metrics.taxaConversaoIntensivo.toFixed(1)}%)
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">Fechadas Intensivo</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
