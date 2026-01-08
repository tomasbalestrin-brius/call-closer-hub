import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Client } from '@/types';
import { useNavigate } from 'react-router-dom';
import { Calendar, Filter, Package } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

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

  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return '-';
    try {
      return format(new Date(dateStr), "dd 'de' MMM", { locale: ptBR });
    } catch {
      return '-';
    }
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
          <Calendar className="w-4 h-4 shrink-0" />
          <span className="truncate">{formatDate(lastCallDate || client.created_at)}</span>
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 shrink-0" />
          <span className="truncate">{client.funnel_source || '-'}</span>
        </div>
        <div className="flex items-center gap-2">
          <Package className="w-4 h-4 shrink-0" />
          <span className="truncate">{client.product_offered || '-'}</span>
        </div>
      </CardContent>
    </Card>
  );
}
