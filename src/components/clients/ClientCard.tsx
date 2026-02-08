import { useMemo, memo, useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Client } from '@/types';
import { useNavigate } from 'react-router-dom';
import { Phone, DollarSign, Package, AlertTriangle, Flame, Calendar, Clock, AtSign } from 'lucide-react';
import { cn } from '@/lib/utils';
import ClientCardMenu from './ClientCardMenu';
import IndicationDialog from './IndicationDialog';
import { formatDistanceToNow, format, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ClientCardProps {
  client: Client;
  lastCallDate?: string | null;
  onClick?: () => void;
  onUpdate?: () => void;
}

const ClientCardInner = memo(function ClientCard({ client, lastCallDate, onClick, onUpdate }: ClientCardProps) {
  const navigate = useNavigate();
  const [indicationDialogOpen, setIndicationDialogOpen] = useState(false);

  const handleClick = () => {
    if (onClick) {
      onClick();
    } else {
      navigate(`/clients/${client.id}`);
    }
  };

  const formatCurrency = (value: number | null | undefined) => {
    if (!value) return '-';
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  // Verificar se dados estão incompletos
  const isIncomplete = !client.phone || !client.revenue || !client.product_offered;
  
  // Verificar se passou mais de 24 horas desde a criação
  const createdAt = new Date(client.created_at);
  const hoursOld = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60);
  const showAlert = isIncomplete && hoursOld >= 24;

  // Verificar se cliente está em repitch há mais de 7 dias
  const isOverdueRepitch = useMemo(() => {
    if (client.status !== 'repitch' || !client.status_changed_at) return false;
    const statusChangedAt = new Date(client.status_changed_at);
    const daysSinceChange = differenceInDays(new Date(), statusChangedAt);
    return daysSinceChange >= 7;
  }, [client.status, client.status_changed_at]);

  return (
    <>
      <Card 
        style={{ contentVisibility: 'auto', containIntrinsicSize: '0 220px' }}
        className={cn(
          "cursor-pointer transition-all animate-slide-up relative",
          isOverdueRepitch
            ? "border-destructive bg-destructive/10 hover:border-destructive hover:shadow-destructive/20 hover:shadow-md ring-2 ring-destructive/50"
            : showAlert 
              ? "border-destructive bg-destructive/10 hover:border-destructive hover:shadow-destructive/20 hover:shadow-md" 
              : client.is_super_hot
                ? "border-orange-500/50 bg-orange-500/5 hover:border-orange-500 hover:shadow-orange-500/20 hover:shadow-md"
                : "hover:shadow-md hover:border-accent/50"
        )}
        onClick={handleClick}
      >
        {/* Repitch Overdue Badge */}
        {isOverdueRepitch && (
          <div className="absolute -top-2 -left-2 z-10">
            <div className="bg-destructive text-white text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1 shadow-lg animate-pulse">
              <AlertTriangle className="w-3 h-3" />
              <span>+7 DIAS</span>
            </div>
          </div>
        )}

        {/* Super Hot Badge */}
        {client.is_super_hot && !isOverdueRepitch && (
          <div className="absolute -top-2 -right-2 z-10">
            <div className="bg-gradient-to-r from-orange-500 to-red-500 text-white text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1 shadow-lg animate-pulse">
              <Flame className="w-3 h-3" />
              <span>SUPER QUENTE</span>
            </div>
          </div>
        )}

        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              {(showAlert || isOverdueRepitch) && (
                <AlertTriangle className="w-4 h-4 text-destructive shrink-0" />
              )}
              <h3 className={cn(
                "font-display font-semibold text-base truncate",
                (showAlert || isOverdueRepitch) && "text-destructive"
              )}>{client.name}</h3>
            </div>
            <ClientCardMenu 
              client={client} 
              onUpdate={onUpdate || (() => {})}
              onIndicateClick={() => setIndicationDialogOpen(true)}
            />
          </div>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          {/* Datas */}
          <div className="flex items-center gap-3 text-xs border-b border-border/50 pb-2">
            <div className="flex items-center gap-1" title="Data de entrada no CRM">
              <Calendar className="w-3 h-3 text-primary" />
              <span>{format(new Date(client.created_at), 'dd/MM/yy', { locale: ptBR })}</span>
            </div>
            {client.status_changed_at && (
              <div className="flex items-center gap-1" title="Tempo nesta coluna">
                <Clock className="w-3 h-3 text-amber-500" />
                <span>
                  {formatDistanceToNow(new Date(client.status_changed_at), { 
                    locale: ptBR, 
                    addSuffix: false 
                  })}
                </span>
              </div>
            )}
          </div>
          
          <div className={cn(
            "flex items-center gap-2",
            showAlert && !client.phone && "text-destructive"
          )}>
            <Phone className="w-4 h-4 shrink-0" />
            {client.phone ? (
              <a
                href={`https://wa.me/${client.phone.replace(/\D/g, '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="truncate text-primary hover:underline"
                onClick={(e) => e.stopPropagation()}
              >
                {client.phone}
              </a>
            ) : (
              <span className="truncate">-</span>
            )}
          </div>
          <div className={cn(
            "flex items-center gap-2",
            showAlert && !client.revenue && "text-destructive"
          )}>
            <DollarSign className="w-4 h-4 shrink-0" />
            <span className="truncate">{formatCurrency(client.revenue)}</span>
          </div>
          <div className={cn(
            "flex items-center gap-2",
            showAlert && !client.product_offered && "text-destructive"
          )}>
            <Package className="w-4 h-4 shrink-0" />
            <span className="truncate">{client.product_offered || '-'}</span>
          </div>
          {client.instagram && (
            <div className="flex items-center gap-2">
              <AtSign className="w-4 h-4 shrink-0" />
              <a
                href={`https://instagram.com/${client.instagram.replace(/^@/, '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="truncate text-primary hover:underline"
                onClick={(e) => e.stopPropagation()}
              >
                @{client.instagram.replace(/^@/, '')}
              </a>
            </div>
          )}
        </CardContent>
      </Card>

      <IndicationDialog
        client={client}
        open={indicationDialogOpen}
        onOpenChange={setIndicationDialogOpen}
        onSuccess={onUpdate}
      />
    </>
  );
}, (prev, next) => {
  return prev.client.id === next.client.id
    && prev.client.status === next.client.status
    && prev.client.updated_at === next.client.updated_at
    && prev.client.is_super_hot === next.client.is_super_hot
    && prev.lastCallDate === next.lastCallDate;
});

export default ClientCardInner;
