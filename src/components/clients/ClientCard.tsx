import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Client } from '@/types';
import { useNavigate } from 'react-router-dom';
import { Phone, DollarSign, Package } from 'lucide-react';

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

  return (
    <Card 
      className="cursor-pointer transition-all hover:shadow-md hover:border-accent/50 animate-slide-up"
      onClick={handleClick}
    >
      <CardHeader className="pb-2">
        <h3 className="font-display font-semibold text-base truncate">{client.name}</h3>
      </CardHeader>
      <CardContent className="space-y-2 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <Phone className="w-4 h-4 shrink-0" />
          <span className="truncate">{client.phone || '-'}</span>
        </div>
        <div className="flex items-center gap-2">
          <DollarSign className="w-4 h-4 shrink-0" />
          <span className="truncate">{formatCurrency(client.revenue)}</span>
        </div>
        <div className="flex items-center gap-2">
          <Package className="w-4 h-4 shrink-0" />
          <span className="truncate">{client.product_offered || '-'}</span>
        </div>
      </CardContent>
    </Card>
  );
}
