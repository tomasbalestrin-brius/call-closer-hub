import { Client } from '@/types';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Building2, Mail, Phone, DollarSign } from 'lucide-react';

interface ClientCardProps {
  client: Client;
  onClick?: () => void;
}

export default function ClientCard({ client, onClick }: ClientCardProps) {
  const formatCurrency = (value: number | null) => {
    if (!value) return '-';
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  return (
    <Card 
      className="cursor-pointer transition-all hover:shadow-md hover:border-accent/50 animate-slide-up"
      onClick={onClick}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="font-display font-semibold text-lg">{client.name}</h3>
            {client.company && (
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                <Building2 className="w-3 h-3" />
                <span>{client.company}</span>
              </div>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 text-sm">
          {client.email && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Mail className="w-4 h-4" />
              <span>{client.email}</span>
            </div>
          )}
          {client.phone && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Phone className="w-4 h-4" />
              <span>{client.phone}</span>
            </div>
          )}
          {client.revenue && (
            <div className="flex items-center gap-2 text-success font-medium">
              <DollarSign className="w-4 h-4" />
              <span>{formatCurrency(client.revenue)}</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
