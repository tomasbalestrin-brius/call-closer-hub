import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Client } from '@/types';
import { useNavigate } from 'react-router-dom';
import { Phone, DollarSign, Package, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ClientCardProps {
  client: Client;
  lastCallDate?: string | null;
  onClick?: () => void;
}

export default function ClientCard({ client, lastCallDate, onClick }: ClientCardProps) {
  const navigate = useNavigate();

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

  return (
    <Card 
      className={cn(
        "cursor-pointer transition-all animate-slide-up",
        showAlert 
          ? "border-destructive bg-destructive/10 hover:border-destructive hover:shadow-destructive/20 hover:shadow-md" 
          : "hover:shadow-md hover:border-accent/50"
      )}
      onClick={handleClick}
    >
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          {showAlert && (
            <AlertTriangle className="w-4 h-4 text-destructive shrink-0" />
          )}
          <h3 className={cn(
            "font-display font-semibold text-base truncate",
            showAlert && "text-destructive"
          )}>{client.name}</h3>
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
  );
}
