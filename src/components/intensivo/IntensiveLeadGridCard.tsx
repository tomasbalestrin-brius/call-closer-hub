import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Phone, Building2, Calendar, Clock, Mail, User } from 'lucide-react';
import { IntensiveLead, INTENSIVE_COLUMNS, INTENSIVE_STATUS_LABELS } from '@/types/intensivo';

interface IntensiveLeadGridCardProps {
  lead: IntensiveLead;
  onClick: () => void;
}

export function IntensiveLeadGridCard({ lead, onClick }: IntensiveLeadGridCardProps) {
  const currentColumn = INTENSIVE_COLUMNS.find(c => c.id === lead.status);
  const formattedDate = format(new Date(lead.created_at), "dd 'de' MMM", { locale: ptBR });
  
  const timeInStatus = formatDistanceToNow(new Date(lead.status_changed_at), {
    addSuffix: false,
    locale: ptBR,
  });

  const isPositiveStatus = ['confirmados', 'ingresso_retirado', 'compareceram'].includes(lead.status);
  const isNegativeStatus = ['nao_compareceram', 'sem_interesse'].includes(lead.status);

  return (
    <Card 
      className={cn(
        'cursor-pointer transition-all hover:shadow-md hover:border-accent/50 animate-slide-up',
        isPositiveStatus && 'border-l-4 border-l-green-500',
        isNegativeStatus && 'border-l-4 border-l-red-500'
      )}
      onClick={onClick}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h3 className="font-display font-semibold text-lg truncate">{lead.name}</h3>
            {lead.company && (
              <p className="text-sm text-muted-foreground truncate">{lead.company}</p>
            )}
            {lead.niche && (
              <p className="text-xs text-muted-foreground/70 truncate mt-0.5">{lead.niche}</p>
            )}
          </div>
          <div className="flex flex-col items-end gap-1">
            <Badge className={cn('font-medium text-xs text-white', currentColumn?.color)}>
              {INTENSIVE_STATUS_LABELS[lead.status]}
            </Badge>
            {lead.source && (
              <Badge variant="outline" className="text-xs">
                {lead.source}
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Calendar className="w-4 h-4 flex-shrink-0" />
            <span>{formattedDate}</span>
          </div>
          
          {lead.phone && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Phone className="w-4 h-4 flex-shrink-0" />
              <span className="truncate">{lead.phone}</span>
            </div>
          )}
          
          {lead.email && (
            <div className="flex items-center gap-2 text-muted-foreground col-span-2">
              <Mail className="w-4 h-4 flex-shrink-0" />
              <span className="truncate">{lead.email}</span>
            </div>
          )}
        </div>

        {/* Time in Status */}
        <div className="mt-3 pt-3 border-t border-border/50">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Clock className="w-3.5 h-3.5 flex-shrink-0" />
            <span>Há {timeInStatus} nesta etapa</span>
          </div>
        </div>

        {/* Timestamps */}
        {(lead.confirmed_at || lead.ticket_retrieved_at || lead.attended_at) && (
          <div className="mt-2 space-y-1 text-xs text-muted-foreground">
            {lead.confirmed_at && (
              <div className="flex items-center gap-1">
                <span className="text-green-500">✓</span>
                <span>Confirmado: {format(new Date(lead.confirmed_at), 'dd/MM/yyyy')}</span>
              </div>
            )}
            {lead.ticket_retrieved_at && (
              <div className="flex items-center gap-1">
                <span className="text-emerald-500">🎫</span>
                <span>Ingresso: {format(new Date(lead.ticket_retrieved_at), 'dd/MM/yyyy')}</span>
              </div>
            )}
            {lead.attended_at && (
              <div className="flex items-center gap-1">
                <span className="text-green-700">👤</span>
                <span>Compareceu: {format(new Date(lead.attended_at), 'dd/MM/yyyy')}</span>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
