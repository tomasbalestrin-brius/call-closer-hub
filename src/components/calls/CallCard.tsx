import { memo, useState } from 'react';
import { Call, CallStatus, LeadClassification, CloserClassification } from '@/types';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Calendar, Clock, Star, DollarSign, Target, TrendingUp, User } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import CallDetailDialog from './CallDetailDialog';
import { CallCardMenu } from './CallCardMenu';

interface CallCardProps {
  call: Call;
  onClick?: () => void;
  canDelete?: boolean;
  onCallUpdated?: () => void;
}

const statusConfig: Record<CallStatus, { label: string; className: string }> = {
  pendente: { label: 'Pendente', className: 'bg-secondary text-secondary-foreground' },
  em_andamento: { label: 'Em andamento', className: 'bg-info text-info-foreground' },
  follow_up: { label: 'Follow-up', className: 'bg-warning text-warning-foreground' },
  proposta_enviada: { label: 'Proposta enviada', className: 'bg-info text-info-foreground' },
  vendido: { label: 'Vendido', className: 'bg-success text-success-foreground' },
  perdido: { label: 'Perdido', className: 'bg-destructive text-destructive-foreground' },
};

const leadClassificationConfig: Record<LeadClassification, { label: string; className: string }> = {
  pos_venda: { label: 'Pós-venda', className: 'bg-success/20 text-success border-success/30' },
  follow: { label: 'Follow-up', className: 'bg-warning/20 text-warning border-warning/30' },
};

const closerClassificationConfig: Record<CloserClassification, { label: string; className: string }> = {
  iniciante: { label: 'Iniciante', className: 'bg-secondary text-secondary-foreground' },
  intermediario: { label: 'Intermediário', className: 'bg-info/20 text-info' },
  avancado: { label: 'Avançado', className: 'bg-primary/20 text-primary' },
  alta_performance: { label: 'Alta Performance', className: 'bg-success/20 text-success' },
  elite: { label: 'Elite', className: 'bg-gradient-to-r from-amber-500 to-yellow-400 text-white' },
};

const formatCurrency = (value: number | null) => {
  if (!value) return '-';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};

const CallCard = memo(function CallCard({ call, onClick, canDelete = false, onCallUpdated }: CallCardProps) {
  const [showDialog, setShowDialog] = useState(false);
  const statusInfo = statusConfig[call.status];
  const formattedDate = format(new Date(call.call_date), "dd 'de' MMM", { locale: ptBR });

  const handleClick = () => {
    if (onClick) {
      onClick();
    } else {
      setShowDialog(true);
    }
  };

  const leadInfo = call.lead_classification ? leadClassificationConfig[call.lead_classification] : null;
  const closerInfo = call.closer_classification ? closerClassificationConfig[call.closer_classification] : null;

  return (
    <>
      <Card 
        className={cn(
          'cursor-pointer transition-all hover:shadow-md hover:border-accent/50 animate-slide-up',
          call.status === 'vendido' && 'border-l-4 border-l-success'
        )}
        onClick={handleClick}
        style={{ contentVisibility: 'auto', containIntrinsicSize: '0 280px' }}
      >
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <h3 className="font-display font-semibold text-lg truncate">{call.client_name}</h3>
              {call.product && (
                <p className="text-sm text-muted-foreground truncate">{call.product}</p>
              )}
              {call.niche && (
                <p className="text-xs text-muted-foreground/70 truncate mt-0.5">{call.niche}</p>
              )}
            </div>
            <div className="flex items-center gap-1">
              <div className="flex flex-col items-end gap-1">
                <Badge className={cn('font-medium text-xs', statusInfo.className)}>
                  {statusInfo.label}
                </Badge>
                {leadInfo && (
                  <Badge variant="outline" className={cn('text-xs border', leadInfo.className)}>
                    {leadInfo.label}
                  </Badge>
                )}
              </div>
              <CallCardMenu
                call={call}
                canDelete={canDelete}
                onViewDetails={() => setShowDialog(true)}
                onCallUpdated={onCallUpdated || (() => {})}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Calendar className="w-4 h-4 flex-shrink-0" />
              <span>{formattedDate}</span>
            </div>
            {call.call_time && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Clock className="w-4 h-4 flex-shrink-0" />
                <span>{call.call_time.slice(0, 5)}</span>
              </div>
            )}
            {call.score !== null && call.score !== undefined && (
              <div className="flex items-center gap-2">
                <Star className="w-4 h-4 text-warning flex-shrink-0" />
                <span className="font-medium">{call.score}/10</span>
              </div>
            )}
            {call.sale_value && (
              <div className="flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-success flex-shrink-0" />
                <span className="font-medium text-success">{formatCurrency(call.sale_value)}</span>
              </div>
            )}
          </div>

          {/* AI Analysis Info */}
          {(call.main_pain || closerInfo) && (
            <div className="mt-3 pt-3 border-t border-border/50 space-y-2">
              {call.main_pain && (
                <div className="flex items-start gap-2 text-xs">
                  <Target className="w-3.5 h-3.5 text-destructive flex-shrink-0 mt-0.5" />
                  <span className="text-muted-foreground line-clamp-2">{call.main_pain}</span>
                </div>
              )}
              {closerInfo && (
                <div className="flex items-center gap-2">
                  <User className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                  <Badge className={cn('text-xs', closerInfo.className)}>
                    {closerInfo.label}
                  </Badge>
                </div>
              )}
            </div>
          )}

          {/* Next Contact */}
          {call.next_contact_date && (
            <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
              <TrendingUp className="w-3.5 h-3.5 flex-shrink-0" />
              <span>Próximo contato: {format(new Date(call.next_contact_date), "dd/MM/yyyy")}</span>
            </div>
          )}
        </CardContent>
      </Card>

      <CallDetailDialog 
        call={call} 
        open={showDialog} 
        onOpenChange={setShowDialog} 
      />
    </>
  );
}, (prev, next) => {
  return prev.call.id === next.call.id 
    && prev.call.status === next.call.status
    && prev.call.updated_at === next.call.updated_at
    && prev.canDelete === next.canDelete;
});

export default CallCard;
