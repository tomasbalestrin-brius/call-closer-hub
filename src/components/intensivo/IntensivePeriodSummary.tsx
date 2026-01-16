import { format, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, MapPin, Users, Ticket, CheckCircle } from 'lucide-react';
import { IntensiveLead, IntensiveEdition } from '@/types/intensivo';
import { safeDate } from '@/lib/dateUtils';

interface IntensivePeriodSummaryProps {
  leads: IntensiveLead[];
  edition: IntensiveEdition | undefined;
}

export function IntensivePeriodSummary({ leads, edition }: IntensivePeriodSummaryProps) {
  if (!edition) return null;

  const eventDate = safeDate(edition.event_date);
  
  if (!eventDate) return null;

  const daysUntilEvent = differenceInDays(eventDate, new Date());
  const formattedEventDate = format(eventDate, "dd 'de' MMMM 'de' yyyy", { locale: ptBR });

  // Calculate stats
  const confirmed = leads.filter(l => 
    ['confirmados', 'ingresso_retirado', 'aquecimento_30d', 'aquecimento_15d', 'aquecimento_7d', 'aquecimento_1d', 'compareceram'].includes(l.status)
  ).length;
  
  const ticketsRetrieved = leads.filter(l => 
    ['ingresso_retirado', 'aquecimento_30d', 'aquecimento_15d', 'aquecimento_7d', 'aquecimento_1d', 'compareceram'].includes(l.status)
  ).length;
  
  const attended = leads.filter(l => l.status === 'compareceram').length;
  
  const conversionRate = leads.length > 0 
    ? Math.round((attended / leads.length) * 100) 
    : 0;

  return (
    <Card className="border-orange-500/20 bg-gradient-to-r from-orange-500/5 to-transparent">
      <CardContent className="py-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          {/* Edition Info */}
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-lg bg-orange-500/10">
              <Calendar className="w-6 h-6 text-orange-500" />
            </div>
            <div>
              <h3 className="font-semibold text-lg">{edition.name}</h3>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>{formattedEventDate}</span>
                {edition.location && (
                  <>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {edition.location}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Days countdown */}
          {daysUntilEvent >= 0 && (
            <Badge 
              variant={daysUntilEvent <= 7 ? 'destructive' : 'secondary'} 
              className="text-sm px-3 py-1"
            >
              {daysUntilEvent === 0 
                ? '🔥 Evento hoje!' 
                : daysUntilEvent === 1 
                  ? '🔥 Falta 1 dia'
                  : `⏰ Faltam ${daysUntilEvent} dias`
              }
            </Badge>
          )}

          {/* Quick Stats */}
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-muted-foreground" />
              <div className="text-right">
                <p className="text-sm font-medium">{leads.length}</p>
                <p className="text-xs text-muted-foreground">Total</p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-500" />
              <div className="text-right">
                <p className="text-sm font-medium">{confirmed}</p>
                <p className="text-xs text-muted-foreground">Confirmados</p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <Ticket className="w-4 h-4 text-emerald-500" />
              <div className="text-right">
                <p className="text-sm font-medium">{ticketsRetrieved}</p>
                <p className="text-xs text-muted-foreground">Ingressos</p>
              </div>
            </div>
            
            <div className="text-right">
              <p className="text-sm font-medium text-orange-500">{conversionRate}%</p>
              <p className="text-xs text-muted-foreground">Comparecimento</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
