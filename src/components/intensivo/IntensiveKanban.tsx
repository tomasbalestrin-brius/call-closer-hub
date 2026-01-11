import { useState, useRef } from 'react';
import { format, formatDistanceToNow, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { IntensiveLeadCard } from './IntensiveLeadCard';
import { IntensiveLeadDetailDialog } from './IntensiveLeadDetailDialog';
import { useIntensivoCRM } from '@/hooks/useIntensivoCRM';
import { INTENSIVE_COLUMNS, type IntensiveLead, type IntensiveLeadStatus, type IntensiveEdition } from '@/types/intensivo';
import { 
  MessageSquare, 
  Brain, 
  Send, 
  Clock, 
  CheckCircle, 
  Ticket, 
  Flame, 
  UserCheck, 
  UserX, 
  XCircle, 
  Calendar 
} from 'lucide-react';

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  MessageSquare,
  Brain,
  Send,
  Clock,
  CheckCircle,
  Ticket,
  Flame,
  UserCheck,
  UserX,
  XCircle,
  Calendar,
};

interface IntensiveKanbanProps {
  leads: IntensiveLead[];
  editionId: string;
  loading?: boolean;
  edition?: IntensiveEdition;
}

export function IntensiveKanban({ leads, editionId, loading, edition }: IntensiveKanbanProps) {
  const { moveLeadStatus } = useIntensivoCRM(editionId);
  const [selectedLead, setSelectedLead] = useState<IntensiveLead | null>(null);
  const [draggedLead, setDraggedLead] = useState<IntensiveLead | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);

  // Calculate days until event
  const daysUntilEvent = edition 
    ? differenceInDays(new Date(edition.event_date), new Date())
    : null;

  const handleDragStart = (e: React.DragEvent, lead: IntensiveLead) => {
    setDraggedLead(lead);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, columnId: string) => {
    e.preventDefault();
    setDragOverColumn(columnId);
  };

  const handleDragLeave = () => {
    setDragOverColumn(null);
  };

  const handleDrop = async (e: React.DragEvent, newStatus: IntensiveLeadStatus) => {
    e.preventDefault();
    setDragOverColumn(null);
    
    if (draggedLead && draggedLead.status !== newStatus) {
      await moveLeadStatus.mutateAsync({
        leadId: draggedLead.id,
        newStatus,
      });
    }
    
    setDraggedLead(null);
  };

  const getLeadsByStatus = (status: IntensiveLeadStatus) => {
    return leads.filter(lead => lead.status === status);
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
      {/* Days countdown */}
      {daysUntilEvent !== null && daysUntilEvent >= 0 && (
        <div className="mb-4 p-3 rounded-lg bg-orange-500/10 border border-orange-500/20">
          <div className="flex items-center gap-2 text-orange-600">
            <Flame className="w-5 h-5" />
            <span className="font-medium">
              {daysUntilEvent === 0 
                ? 'Evento hoje!' 
                : daysUntilEvent === 1 
                  ? 'Falta 1 dia para o evento'
                  : `Faltam ${daysUntilEvent} dias para o evento`
              }
            </span>
          </div>
        </div>
      )}

      <ScrollArea className="w-full">
        <div className="flex gap-4 pb-4 min-w-max">
          {INTENSIVE_COLUMNS.map((column) => {
            const columnLeads = getLeadsByStatus(column.id);
            const IconComponent = ICON_MAP[column.icon] || MessageSquare;
            const isDragOver = dragOverColumn === column.id;

            return (
              <div
                key={column.id}
                className={`flex flex-col w-72 shrink-0 rounded-lg border bg-card transition-colors ${
                  isDragOver ? 'border-primary bg-primary/5' : 'border-border'
                }`}
                onDragOver={(e) => handleDragOver(e, column.id)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, column.id)}
              >
                {/* Column Header */}
                <div className={`p-3 rounded-t-lg ${column.color}`}>
                  <div className="flex items-center justify-between text-white">
                    <div className="flex items-center gap-2">
                      <IconComponent className="w-4 h-4" />
                      <span className="font-medium text-sm">{column.title}</span>
                    </div>
                    <Badge variant="secondary" className="bg-white/20 text-white hover:bg-white/30">
                      {columnLeads.length}
                    </Badge>
                  </div>
                </div>

                {/* Column Content */}
                <div className="flex-1 p-2 space-y-2 min-h-[200px] max-h-[calc(100vh-350px)] overflow-y-auto">
                  {columnLeads.map((lead) => (
                    <IntensiveLeadCard
                      key={lead.id}
                      lead={lead}
                      onClick={() => setSelectedLead(lead)}
                      onDragStart={(e) => handleDragStart(e, lead)}
                      isDragging={draggedLead?.id === lead.id}
                    />
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

      {/* Lead Detail Dialog */}
      <IntensiveLeadDetailDialog
        lead={selectedLead}
        open={!!selectedLead}
        onOpenChange={(open) => !open && setSelectedLead(null)}
        editionId={editionId}
      />
    </>
  );
}
