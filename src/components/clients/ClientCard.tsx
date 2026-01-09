import { useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Client } from '@/types';
import { useNavigate } from 'react-router-dom';
import { Phone, DollarSign, Package, AlertTriangle, Flame } from 'lucide-react';
import { cn } from '@/lib/utils';
import ClientCardMenu from './ClientCardMenu';
import IndicationDialog from './IndicationDialog';

interface ClientCardProps {
  client: Client;
  lastCallDate?: string | null;
  onClick?: () => void;
  onUpdate?: () => void;
}

export default function ClientCard({ client, lastCallDate, onClick, onUpdate }: ClientCardProps) {
  const navigate = useNavigate();
  const [indicationDialogOpen, setIndicationDialogOpen] = useState(false);

  const handleClick = () => {
    if (onClick) {
      onClick();
    } else {
      navigate(`/clients/${client.id}`);
    }
  };

  const handleUpdate = () => {
    onUpdate?.();
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

  return (
    <>
      <Card 
        className={cn(
          "cursor-pointer transition-all animate-slide-up relative",
          showAlert 
            ? "border-destructive bg-destructive/10 hover:border-destructive hover:shadow-destructive/20 hover:shadow-md" 
            : client.is_super_hot
              ? "border-orange-500/50 bg-orange-500/5 hover:border-orange-500 hover:shadow-orange-500/20 hover:shadow-md"
              : "hover:shadow-md hover:border-accent/50"
        )}
        onClick={handleClick}
      >
        {/* Super Hot Badge */}
        {client.is_super_hot && (
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
              {showAlert && (
                <AlertTriangle className="w-4 h-4 text-destructive shrink-0" />
              )}
              <h3 className={cn(
                "font-display font-semibold text-base truncate",
                showAlert && "text-destructive"
              )}>{client.name}</h3>
            </div>
            <ClientCardMenu 
              client={client} 
              onUpdate={handleUpdate}
              onIndicateClick={() => setIndicationDialogOpen(true)}
            />
          </div>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <div className={cn(
            "flex items-center gap-2",
            showAlert && !client.phone && "text-destructive"
          )}>
            <Phone className="w-4 h-4 shrink-0" />
            <span className="truncate">{client.phone || '-'}</span>
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
        </CardContent>
      </Card>

      <IndicationDialog
        client={client}
        open={indicationDialogOpen}
        onOpenChange={setIndicationDialogOpen}
        onSuccess={handleUpdate}
      />
    </>
  );
}
