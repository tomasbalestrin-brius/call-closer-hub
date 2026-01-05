import { Call, CallStatus } from '@/types';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Calendar, Clock, Star, DollarSign } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface CallCardProps {
  call: Call;
  onClick?: () => void;
}

const statusConfig: Record<CallStatus, { label: string; className: string }> = {
  pendente: { label: 'Pendente', className: 'bg-secondary text-secondary-foreground' },
  em_andamento: { label: 'Em andamento', className: 'bg-info text-info-foreground' },
  follow_up: { label: 'Follow-up', className: 'bg-warning text-warning-foreground' },
  proposta_enviada: { label: 'Proposta enviada', className: 'bg-info text-info-foreground' },
  vendido: { label: 'Vendido', className: 'bg-success text-success-foreground' },
  perdido: { label: 'Perdido', className: 'bg-destructive text-destructive-foreground' },
};

export default function CallCard({ call, onClick }: CallCardProps) {
  const statusInfo = statusConfig[call.status];
  const formattedDate = format(new Date(call.call_date), "dd 'de' MMM", { locale: ptBR });
  
  const formatCurrency = (value: number | null) => {
    if (!value) return '-';
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  return (
    <Card 
      className={cn(
        'cursor-pointer transition-all hover:shadow-md hover:border-accent/50 animate-slide-up',
        call.status === 'vendido' && 'border-l-4 border-l-success'
      )}
      onClick={onClick}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="font-display font-semibold text-lg">{call.client_name}</h3>
            {call.product && (
              <p className="text-sm text-muted-foreground">{call.product}</p>
            )}
          </div>
          <Badge className={cn('font-medium', statusInfo.className)}>
            {statusInfo.label}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Calendar className="w-4 h-4" />
            <span>{formattedDate}</span>
          </div>
          {call.call_time && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Clock className="w-4 h-4" />
              <span>{call.call_time.slice(0, 5)}</span>
            </div>
          )}
          {call.score && (
            <div className="flex items-center gap-2">
              <Star className="w-4 h-4 text-warning" />
              <span className="font-medium">{call.score}/10</span>
            </div>
          )}
          {call.sale_value && (
            <div className="flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-success" />
              <span className="font-medium text-success">{formatCurrency(call.sale_value)}</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
