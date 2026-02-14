import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Phone, Building2, Flame, Thermometer, Snowflake, Trash2 } from 'lucide-react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import type { IntensiveLead, LeadTemperature } from '@/types/intensivo';
import { cn } from '@/lib/utils';
import { safeDate } from '@/lib/dateUtils';

interface IntensiveLeadCardProps {
  lead: IntensiveLead;
  onClick: () => void;
  onDelete?: (id: string) => void;
}

const temperatureConfig: Record<LeadTemperature, { icon: typeof Flame; label: string; className: string }> = {
  quente: { icon: Flame, label: 'Quente', className: 'bg-red-500/10 text-red-600 border-red-500/30' },
  morno: { icon: Thermometer, label: 'Morno', className: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/30' },
  frio: { icon: Snowflake, label: 'Frio', className: 'bg-blue-500/10 text-blue-600 border-blue-500/30' },
};

export function IntensiveLeadCard({ lead, onClick, onDelete }: IntensiveLeadCardProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);

  const statusChangedDate = safeDate(lead.status_changed_at);
  const timeInStatus = statusChangedDate
    ? formatDistanceToNow(statusChangedDate, { addSuffix: false, locale: ptBR })
    : 'desconhecido';

  const temp = temperatureConfig[lead.lead_temperature || 'morno'];
  const TempIcon = temp.icon;

  return (
    <>
      <Card
        style={{ contentVisibility: 'auto', containIntrinsicSize: '0 280px' }}
        className="p-3 cursor-pointer hover:shadow-md transition-all"
        onClick={onClick}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-1">
            <h4 className="font-medium text-sm truncate">{lead.name}</h4>
            <div className="flex items-center gap-1 shrink-0">
              <Badge variant="outline" className={cn('text-xs py-0 gap-1', temp.className)}>
                <TempIcon className="w-3 h-3" />
                {temp.label}
              </Badge>
              {onDelete && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-muted-foreground hover:text-destructive"
                  onClick={(e) => { e.stopPropagation(); setConfirmOpen(true); }}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              )}
            </div>
          </div>

          {(lead.company || lead.niche) && (
            <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
              <Building2 className="w-3 h-3" />
              <span className="truncate">{[lead.company, lead.niche].filter(Boolean).join(' | ')}</span>
            </div>
          )}

          {lead.phone && (
            <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
              <Phone className="w-3 h-3" />
              <a
                href={`https://wa.me/${lead.phone.replace(/\D/g, '')}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="hover:text-green-600 hover:underline"
              >
                {lead.phone}
              </a>
            </div>
          )}

          <div className="flex items-center gap-2 mt-2">
            {lead.source && (
              <Badge variant="outline" className="text-xs py-0">{lead.source}</Badge>
            )}
          </div>

          <div className="mt-2 text-xs text-muted-foreground">Há {timeInStatus} nesta etapa</div>
        </div>
      </Card>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Lead</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir <strong>{lead.name}</strong>? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => onDelete?.(lead.id)}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
