import { Client } from '@/types';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Building2, Mail, Phone, DollarSign, Target, Briefcase, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';

interface ClientCardProps {
  client: Client;
  onClick?: () => void;
}

export default function ClientCard({ client, onClick }: ClientCardProps) {
  const navigate = useNavigate();

  const formatCurrency = (value: number | null) => {
    if (!value) return '-';
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const handleClick = () => {
    if (onClick) {
      onClick();
    } else {
      navigate(`/clients/${client.id}`);
    }
  };

  return (
    <Card 
      className="cursor-pointer transition-all hover:shadow-md hover:border-accent/50 animate-slide-up"
      onClick={handleClick}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h3 className="font-display font-semibold text-lg truncate">{client.name}</h3>
            {client.company && (
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                <Building2 className="w-3 h-3 flex-shrink-0" />
                <span className="truncate">{client.company}</span>
              </div>
            )}
          </div>
          {client.source === 'google_drive' && (
            <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/30">
              Auto
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 text-sm">
          {client.niche && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Briefcase className="w-4 h-4 flex-shrink-0" />
              <span className="truncate">{client.niche}</span>
            </div>
          )}
          {client.email && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Mail className="w-4 h-4 flex-shrink-0" />
              <span className="truncate">{client.email}</span>
            </div>
          )}
          {client.phone && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Phone className="w-4 h-4 flex-shrink-0" />
              <span>{client.phone}</span>
            </div>
          )}
          {client.revenue && (
            <div className="flex items-center gap-2 text-success font-medium">
              <DollarSign className="w-4 h-4 flex-shrink-0" />
              <span>{formatCurrency(client.revenue)}</span>
            </div>
          )}
          {client.has_partner !== null && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Users className="w-4 h-4 flex-shrink-0" />
              <span>{client.has_partner ? 'Com sócio' : 'Sem sócio'}</span>
            </div>
          )}
        </div>

        {/* AI-extracted info */}
        {client.main_pain && (
          <div className="mt-3 pt-3 border-t border-border/50">
            <div className="flex items-start gap-2 text-xs">
              <Target className="w-3.5 h-3.5 text-destructive flex-shrink-0 mt-0.5" />
              <span className="text-muted-foreground line-clamp-2">{client.main_pain}</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
