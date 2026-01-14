import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { User, Calendar, Phone, Mail, Link as LinkIcon } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { TICKET_LABELS } from '@/types';
import type { PortfolioStudent, TicketType } from '@/types';

interface StudentCardProps {
  student: PortfolioStudent;
  onClick: () => void;
}

const ticketStyles: Record<TicketType, string> = {
  '29_90': 'bg-amber-500/10 text-amber-600 border-amber-500/30',
  '12k': 'bg-sky-500/10 text-sky-600 border-sky-500/30',
  '80k': 'bg-yellow-500/10 text-yellow-600 border-yellow-500/30',
};

export default function StudentCard({ student, onClick }: StudentCardProps) {
  const isFromCRM = !!student.client_id;
  
  return (
    <Card 
      className={cn(
        "cursor-pointer hover:border-primary/50 transition-colors",
        isFromCRM && "border-l-4 border-l-primary"
      )}
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
              <User className="w-6 h-6 text-muted-foreground" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-foreground">{student.name}</h3>
                {isFromCRM && (
                  <Badge variant="outline" className="text-xs gap-1 bg-primary/5">
                    <LinkIcon className="w-3 h-3" />
                    CRM
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
                {student.phone && (
                  <span className="flex items-center gap-1">
                    <Phone className="w-3 h-3" />
                    {student.phone}
                  </span>
                )}
                {student.email && (
                  <span className="flex items-center gap-1">
                    <Mail className="w-3 h-3" />
                    {student.email}
                  </span>
                )}
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                <Calendar className="w-3 h-3" />
                {format(new Date(student.entry_date), 'dd/MM/yyyy', { locale: ptBR })}
              </div>
              {student.niche && (
                <p className="text-sm text-muted-foreground mt-1">{student.niche}</p>
              )}
            </div>
            <Badge 
              variant="outline" 
              className={cn('font-medium', ticketStyles[student.current_ticket])}
            >
              {TICKET_LABELS[student.current_ticket]}
            </Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
