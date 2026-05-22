import { memo, useState } from 'react';
import { Call, CallStatus, LeadClassification, CloserClassification } from '@/types';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar, Clock, Star, DollarSign, Target, TrendingUp, User, Flame, Thermometer, Snowflake, Phone, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import CallDetailDialog from './CallDetailDialog';
import { CallCardMenu } from './CallCardMenu';
import { MarkAsSoldDialog } from './MarkAsSoldDialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';

interface CallCardProps {
  call: Call;
  onClick?: () => void;
  canDelete?: boolean;
  onCallUpdated?: () => void;
  clientPhone?: string | null;
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

const temperatureConfig: Record<string, { icon: typeof Flame; label: string; className: string }> = {
  quente: { icon: Flame, label: 'Quente', className: 'bg-red-500/10 text-red-600 border-red-500/30' },
  morno: { icon: Thermometer, label: 'Morno', className: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/30' },
  frio: { icon: Snowflake, label: 'Frio', className: 'bg-blue-500/10 text-blue-600 border-blue-500/30' },
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

const CallCard = memo(function CallCard({ call, onClick, canDelete = false, onCallUpdated, clientPhone }: CallCardProps) {
  const [showDialog, setShowDialog] = useState(false);
  const [showSoldDialog, setShowSoldDialog] = useState(false);
  const qc = useQueryClient();
  const statusInfo = statusConfig[call.status];
  const formattedDate = format(new Date(call.call_date), "dd 'de' MMM", { locale: ptBR });
  const joinedClient = (call as any).clients as { sale_value?: number | null; entry_value?: number | null; is_sold?: boolean } | null | undefined;
  const displaySaleValue = call.sale_value ?? joinedClient?.sale_value ?? null;
  const displayEntryValue = call.entry_value ?? joinedClient?.entry_value ?? null;
  const isSoldVisually = call.status === 'vendido' || joinedClient?.is_sold === true;
  const isIncompleteAnalysis =
    (call.score === 0 || call.score === null || call.score === undefined) &&
    /^Lead\s*-/i.test(call.client_name || '');

  const handleClick = () => {
    if (onClick) {
      onClick();
    } else {
      setShowDialog(true);
    }
  };

  const handleStatusChange = async (newStatus: CallStatus) => {
    if (newStatus === call.status) return;
    if (newStatus === 'vendido') {
      setShowSoldDialog(true);
      return;
    }
    const { error } = await supabase.from('calls').update({ status: newStatus }).eq('id', call.id);
    if (error) { toast.error('Erro ao alterar status'); return; }
    toast.success('Status atualizado');
    qc.invalidateQueries({ queryKey: ['calls'] });
    onCallUpdated?.();
  };

  const leadInfo = call.lead_classification ? leadClassificationConfig[call.lead_classification] : null;
  const closerInfo = call.closer_classification ? closerClassificationConfig[call.closer_classification] : null;
  const tempInfo = call.lead_temperature ? temperatureConfig[call.lead_temperature] : null;
  const TempIcon = tempInfo?.icon;

  return (
    <>
      <Card 
        className={cn(
          'relative cursor-pointer transition-all hover:shadow-md hover:border-accent/50 animate-slide-up',
          isSoldVisually && 'border-l-4 border-l-success',
          isIncompleteAnalysis && 'border-l-4 border-l-warning'
        )}
        onClick={handleClick}
        style={{ contentVisibility: 'auto', containIntrinsicSize: '0 280px' }}
      >
        {isIncompleteAnalysis && (
          <div className="absolute top-2 left-2 z-10 flex items-center gap-1 rounded-md bg-warning/15 border border-warning/40 px-2 py-1 text-[10px] font-semibold text-warning shadow-sm pointer-events-none">
            <AlertTriangle className="w-3 h-3" />
            Análise incompleta
          </div>
        )}
        {displaySaleValue ? (
          <div className="absolute bottom-2 right-2 z-10 flex items-center gap-1 rounded-md bg-success/15 border border-success/40 px-2 py-1 text-xs font-bold text-success shadow-sm pointer-events-none">
            <DollarSign className="w-3 h-3" />
            {formatCurrency(displaySaleValue)}
          </div>
        ) : null}
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
                <Select value={call.status} onValueChange={(v) => handleStatusChange(v as CallStatus)}>
                  <SelectTrigger
                    onClick={(e) => e.stopPropagation()}
                    className={cn(
                      'h-auto py-1 px-2 text-xs font-medium border-0 rounded-md gap-1 w-auto min-w-0 [&>svg]:h-3 [&>svg]:w-3',
                      statusInfo.className
                    )}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent onClick={(e) => e.stopPropagation()}>
                    {(Object.keys(statusConfig) as CallStatus[]).map((s) => (
                      <SelectItem key={s} value={s}>{statusConfig[s].label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {leadInfo && (
                  <Badge variant="outline" className={cn('text-xs border', leadInfo.className)}>
                    {leadInfo.label}
                  </Badge>
                )}
                {tempInfo && TempIcon && (
                  <Badge variant="outline" className={cn('text-xs border gap-1', tempInfo.className)}>
                    <TempIcon className="w-3 h-3" />
                    {tempInfo.label}
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
            {clientPhone && (
              <div className="flex items-center gap-2 text-muted-foreground col-span-2">
                <Phone className="w-4 h-4 flex-shrink-0" />
                <a
                  href={`https://wa.me/${clientPhone.replace(/\D/g, '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="truncate text-primary hover:underline"
                >
                  {clientPhone}
                </a>
              </div>
            )}
            {call.score !== null && call.score !== undefined && (
              <div className="flex items-center gap-2">
                <Star className="w-4 h-4 text-warning flex-shrink-0" />
                <span className="font-medium">{call.score}/10</span>
              </div>
            )}
            {displaySaleValue && (
              <div className="flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-success flex-shrink-0" />
                <span className="font-medium text-success">
                  {formatCurrency(displaySaleValue)}
                  {displayEntryValue ? <span className="text-xs text-muted-foreground ml-1">(ent. {formatCurrency(displayEntryValue)})</span> : null}
                </span>
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
    && prev.call.lead_temperature === next.call.lead_temperature
    && prev.canDelete === next.canDelete;
});

export default CallCard;
