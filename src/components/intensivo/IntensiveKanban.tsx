import { useState, useRef, useEffect, useCallback } from 'react';
import { differenceInDays } from 'date-fns';
import { useDragAutoScroll } from '@/hooks/useDragAutoScroll';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { IntensiveLeadCard } from './IntensiveLeadCard';
import { IntensiveLeadDetailDialog } from './IntensiveLeadDetailDialog';
import { useIntensivoCRM } from '@/hooks/useIntensivoCRM';
import { safeDate } from '@/lib/dateUtils';
import { INTENSIVE_COLUMNS, type IntensiveLead, type IntensiveLeadStatus, type IntensiveEdition } from '@/types/intensivo';
import { 
  MessageSquare, Brain, Send, Clock, CheckCircle, Ticket, Flame, 
  UserCheck, UserX, XCircle, Calendar 
} from 'lucide-react';
import { cn } from '@/lib/utils';

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  MessageSquare, Brain, Send, Clock, CheckCircle, Ticket, Flame,
  UserCheck, UserX, XCircle, Calendar,
};

interface IntensiveKanbanProps {
  leads: IntensiveLead[];
  editionId: string;
  loading?: boolean;
  edition?: IntensiveEdition;
}

export function IntensiveKanban({ leads, editionId, loading, edition }: IntensiveKanbanProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);
  const { handleDragOver: autoScrollDragOver, stopScroll } = useDragAutoScroll(scrollRef);
  const { moveLeadStatus } = useIntensivoCRM(editionId);
  const [selectedLead, setSelectedLead] = useState<IntensiveLead | null>(null);
  const [draggedLead, setDraggedLead] = useState<IntensiveLead | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);

  useEffect(() => {
    const root = document.querySelector('.intensive-kanban-scroll [data-radix-scroll-area-viewport]');
    if (root) (scrollRef as React.MutableRefObject<HTMLElement | null>).current = root as HTMLElement;
  }, []);

  const eventDate = edition ? safeDate(edition.event_date) : null;
  const daysUntilEvent = eventDate ? differenceInDays(eventDate, new Date()) : null;

  const handleDragStart = useCallback((e: React.DragEvent, lead: IntensiveLead) => {
    isDraggingRef.current = true;
    setDraggedLead(lead);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', lead.id);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, columnId: string) => {
    e.preventDefault();
    setDragOverColumn(columnId);
    autoScrollDragOver(e);
  }, [autoScrollDragOver]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setDragOverColumn(null);
  }, []);

  const handleDragEnd = useCallback(() => {
    setDraggedLead(null);
    setDragOverColumn(null);
    stopScroll();
    setTimeout(() => { isDraggingRef.current = false; }, 0);
  }, [stopScroll]);

  const handleDrop = useCallback(async (e: React.DragEvent, newStatus: IntensiveLeadStatus) => {
    e.preventDefault();
    setDragOverColumn(null);
    stopScroll();
    
    if (draggedLead && draggedLead.status !== newStatus) {
      await moveLeadStatus.mutateAsync({ leadId: draggedLead.id, newStatus });
    }
    setDraggedLead(null);
  }, [draggedLead, moveLeadStatus, stopScroll]);

  const handleCardClick = useCallback((lead: IntensiveLead) => {
    if (isDraggingRef.current) return;
    setSelectedLead(lead);
  }, []);

  const getLeadsByStatus = (status: IntensiveLeadStatus) => leads.filter(lead => lead.status === status);

  const getColumnCount = (status: IntensiveLeadStatus) => {
    if (status === 'confirmados') {
      return leads.filter(lead => lead.confirmed_at !== null && lead.status !== 'aguardando_confirmacao').length;
    }
    if (status === 'ingresso_retirado') {
      const before = ['abordagem_inicial', 'nivel_consciencia', 'convite_intensivo', 'aguardando_confirmacao', 'confirmados'];
      return leads.filter(lead => lead.ticket_retrieved_at !== null && !before.includes(lead.status)).length;
    }
    return leads.filter(lead => lead.status === status).length;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <>
      {daysUntilEvent !== null && daysUntilEvent >= 0 && (
        <div className="mb-4 p-3 rounded-lg bg-orange-500/10 border border-orange-500/20">
          <div className="flex items-center gap-2 text-orange-600">
            <Flame className="w-5 h-5" />
            <span className="font-medium">
              {daysUntilEvent === 0 ? 'Evento hoje!' : daysUntilEvent === 1 ? 'Falta 1 dia para o evento' : `Faltam ${daysUntilEvent} dias para o evento`}
            </span>
          </div>
        </div>
      )}

      <ScrollArea className="w-full intensive-kanban-scroll">
        <div className="flex gap-4 pb-4 min-w-max">
          {INTENSIVE_COLUMNS.map((column) => {
            const columnLeads = getLeadsByStatus(column.id);
            const IconComponent = ICON_MAP[column.icon] || MessageSquare;
            const isDragOver = dragOverColumn === column.id;

            return (
              <div
                key={column.id}
                className={cn(
                  'flex flex-col w-72 shrink-0 rounded-lg border bg-card transition-colors',
                  isDragOver ? 'border-primary bg-primary/5' : 'border-border'
                )}
                onDragOver={(e) => handleDragOver(e, column.id)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, column.id)}
              >
                <div className={`p-3 rounded-t-lg ${column.color}`}>
                  <div className="flex items-center justify-between text-white">
                    <div className="flex items-center gap-2">
                      <IconComponent className="w-4 h-4" />
                      <span className="font-medium text-sm">{column.title}</span>
                    </div>
                    <Badge variant="secondary" className="bg-white/20 text-white hover:bg-white/30">
                      {getColumnCount(column.id)}
                    </Badge>
                  </div>
                </div>

                <div className="flex-1 p-2 space-y-2 min-h-[200px] max-h-[calc(100vh-350px)] overflow-y-auto">
                  {columnLeads.map((lead) => (
                    <div
                      key={lead.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, lead)}
                      onDragEnd={handleDragEnd}
                      className={cn(
                        'transition-all',
                        draggedLead?.id === lead.id && 'opacity-50 scale-95'
                      )}
                    >
                      <IntensiveLeadCard
                        lead={lead}
                        onClick={() => handleCardClick(lead)}
                      />
                    </div>
                  ))}
                  
                  {columnLeads.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground text-sm">
                      Nenhum lead
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>

      <IntensiveLeadDetailDialog
        lead={selectedLead}
        open={!!selectedLead}
        onOpenChange={(open) => !open && setSelectedLead(null)}
        editionId={editionId}
      />
    </>
  );
}
