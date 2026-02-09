import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Phone, Building2, GripVertical } from 'lucide-react';
import type { IntensiveLead } from '@/types/intensivo';
import { cn } from '@/lib/utils';
import { safeDate } from '@/lib/dateUtils';

interface IntensiveLeadCardProps {
  lead: IntensiveLead;
  onClick: () => void;
  onDragStart: (e: React.DragEvent) => void;
  onDragEnd?: (e: React.DragEvent) => void;
  isDragging?: boolean;
}

export function IntensiveLeadCard({ lead, onClick, onDragStart, onDragEnd, isDragging }: IntensiveLeadCardProps) {
  const statusChangedDate = safeDate(lead.status_changed_at);
  const timeInStatus = statusChangedDate
    ? formatDistanceToNow(statusChangedDate, { addSuffix: false, locale: ptBR })
    : 'desconhecido';

  return (
    <Card
      style={{ contentVisibility: 'auto', containIntrinsicSize: '0 280px' }}
      className={cn(
        'p-3 cursor-pointer hover:shadow-md transition-all group',
        isDragging && 'opacity-50 scale-95'
      )}
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onClick}
    >
      <div className="flex items-start gap-2">
        <div className="opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing">
          <GripVertical className="w-4 h-4 text-muted-foreground" />
        </div>
        
        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-sm truncate">{lead.name}</h4>
          
          {(lead.company || lead.niche) && (
            <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
              <Building2 className="w-3 h-3" />
              <span className="truncate">
                {[lead.company, lead.niche].filter(Boolean).join(' | ')}
              </span>
            </div>
          )}
          
          {lead.phone && (
            <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
              <Phone className="w-3 h-3" />
              <span>{lead.phone}</span>
            </div>
          )}
          
          <div className="flex items-center gap-2 mt-2">
            {lead.source && (
              <Badge variant="outline" className="text-xs py-0">
                {lead.source}
              </Badge>
            )}
          </div>
          
          <div className="mt-2 text-xs text-muted-foreground">
            Há {timeInStatus} nesta etapa
          </div>
        </div>
      </div>
    </Card>
  );
}
