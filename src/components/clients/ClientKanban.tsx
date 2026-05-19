import { useState, useRef, useEffect } from 'react';
import { Client } from '@/types';
import { useDragAutoScroll } from '@/hooks/useDragAutoScroll';
import ClientCard from './ClientCard';
import SaleFormDialog from './SaleFormDialog';
import ColumnSettingsDialog from './settings/ColumnSettingsDialog';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useColumnSettings } from '@/hooks/useColumnSettings';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { 
  Phone, 
  RefreshCw, 
  MessageCircle, 
  Gift, 
  Star, 
  Zap, 
  ThumbsUp, 
  CheckCircle2, 
  XCircle, 
  Archive,
  Settings,
  Send,
  Mail,
  FileText,
  Ticket,
  UserCheck
} from 'lucide-react';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { BulkActionsBar } from '@/components/kanban/BulkActionsBar';

const KANBAN_COLUMNS = [
  { 
    id: 'call_realizada', 
    title: 'Call Realizada', 
    subtitle: 'Preencher dados',
    icon: Phone,
    color: 'bg-blue-500/10 border-blue-500/30 text-blue-600' 
  },
  { 
    id: 'repitch', 
    title: 'RePitch', 
    subtitle: null,
    icon: RefreshCw,
    color: 'bg-orange-500/10 border-orange-500/30 text-orange-600' 
  },
  { 
    id: 'pos_call_0_2', 
    title: 'Pós Call 0-2 dias', 
    subtitle: 'Depoimentos e Conexão',
    icon: MessageCircle,
    color: 'bg-cyan-500/10 border-cyan-500/30 text-cyan-600' 
  },
  { 
    id: 'pos_call_3_7', 
    title: 'Pós Call 3-7 dias', 
    subtitle: 'Presente e Mentoria',
    icon: Gift,
    color: 'bg-green-500/10 border-green-500/30 text-green-600' 
  },
  { 
    id: 'pos_call_8_15', 
    title: 'Pós Call 8-15 dias', 
    subtitle: 'Feedback e Oferta',
    icon: Star,
    color: 'bg-yellow-500/10 border-yellow-500/30 text-yellow-600' 
  },
  { 
    id: 'pos_call_16_21', 
    title: 'Pós Call 16-21 dias', 
    subtitle: 'Convite Intensivo',
    icon: Zap,
    color: 'bg-purple-500/10 border-purple-500/30 text-purple-600' 
  },
  { 
    id: 'sinal_compromisso', 
    title: 'Sinal de Compromisso', 
    subtitle: null,
    icon: ThumbsUp,
    color: 'bg-indigo-500/10 border-indigo-500/30 text-indigo-600' 
  },
  { 
    id: 'venda_realizada', 
    title: 'Venda Realizada', 
    subtitle: null,
    icon: CheckCircle2,
    color: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600' 
  },
  { 
    id: 'aluno_nao_fit', 
    title: 'Aluno Não Fit', 
    subtitle: null,
    icon: XCircle,
    color: 'bg-red-500/10 border-red-500/30 text-red-600' 
  },
  { 
    id: 'pos_21_carterizacao', 
    title: 'Pós 21 dias', 
    subtitle: 'Carterização',
    icon: Archive,
    color: 'bg-slate-500/10 border-slate-500/30 text-slate-600' 
  },
];

const INTENSIVO_COLUMNS = [
  { 
    id: 'enviar_convite_intensivo', 
    title: 'Enviar Convite', 
    subtitle: 'Para o intensivo',
    icon: Mail,
    color: 'bg-blue-500/10 border-blue-500/30 text-blue-600' 
  },
  { 
    id: 'formulario_preenchido', 
    title: 'Formulário Preenchido', 
    subtitle: null,
    icon: FileText,
    color: 'bg-cyan-500/10 border-cyan-500/30 text-cyan-600' 
  },
  { 
    id: 'retirado_ingresso', 
    title: 'Retirado o Ingresso', 
    subtitle: null,
    icon: Ticket,
    color: 'bg-green-500/10 border-green-500/30 text-green-600' 
  },
  { 
    id: 'confirmado_intensivo', 
    title: 'Confirmado', 
    subtitle: null,
    icon: UserCheck,
    color: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600' 
  },
];

interface ClientWithLastCall extends Client {
  lastCallDate?: string | null;
}

interface ClientKanbanProps {
  clients: ClientWithLastCall[];
  onRefresh: () => void;
}

export default function ClientKanban({ clients, onRefresh }: ClientKanbanProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);
  const { handleDragOver: autoScrollDragOver, stopScroll } = useDragAutoScroll(scrollRef);
  const [draggedClient, setDraggedClient] = useState<ClientWithLastCall | null>(null);
  const [saleDialogOpen, setSaleDialogOpen] = useState(false);
  const [clientForSale, setClientForSale] = useState<ClientWithLastCall | null>(null);
  const [editingColumn, setEditingColumn] = useState<string | null>(null);
  const { settings, getColumnSettings, fetchSettings } = useColumnSettings();
  const { isIntensivo } = useUserPermissions();

  const columns = isIntensivo ? INTENSIVO_COLUMNS : KANBAN_COLUMNS;

  // Bulk selection
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const toggleSelected = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedIds.size === clients.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(clients.map((c) => c.id)));
  };

  const handleBulkMove = async (columnId: string) => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    try {
      const payload: Record<string, unknown> = { status: columnId };
      if (columnId === 'venda_realizada') {
        payload.is_sold = true;
        payload.sold_at = new Date().toISOString();
      }
      const { error } = await supabase.from('clients').update(payload).in('id', ids);
      if (error) throw error;
      toast.success(`${ids.length} cliente(s) movido(s)`);
      setSelectedIds(new Set());
      setSelectionMode(false);
      onRefresh();
    } catch (e) {
      console.error(e);
      toast.error('Erro ao mover clientes');
    }
  };

  // Get viewport ref for auto-scroll
  useEffect(() => {
    const root = document.querySelector('.client-kanban-scroll [data-radix-scroll-area-viewport]');
    if (root) (scrollRef as React.MutableRefObject<HTMLElement | null>).current = root as HTMLElement;
  }, []);

  const getColumnDisplay = (column: typeof KANBAN_COLUMNS[0]) => {
    const customSettings = getColumnSettings(column.id);
    return {
      title: customSettings?.custom_title || column.title,
      subtitle: customSettings?.custom_subtitle !== undefined 
        ? customSettings.custom_subtitle 
        : column.subtitle
    };
  };

  const getClientsForColumn = (columnId: string) => {
    if (columnId === 'venda_realizada') {
      return clients.filter(c => c.is_sold || c.status === 'venda_realizada');
    }
    return clients.filter(c => !c.is_sold && (c.status || 'call_realizada') === columnId);
  };

  const handleDragStart = (e: React.DragEvent, client: ClientWithLastCall) => {
    isDraggingRef.current = true;
    setDraggedClient(client);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', client.id);
  };

  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);

  const handleDragOver = (e: React.DragEvent, columnId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverColumn(columnId);
    autoScrollDragOver(e);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setDragOverColumn(null);
  };

  const handleDragEnd = () => {
    setTimeout(() => { isDraggingRef.current = false; }, 0);
    setDraggedClient(null);
    setDragOverColumn(null);
    stopScroll();
  };

  const handleDrop = async (e: React.DragEvent, columnId: string) => {
    e.preventDefault();
    if (!draggedClient) return;

    // If dropping on "venda_realizada", open sale dialog
    if (columnId === 'venda_realizada') {
      setClientForSale(draggedClient);
      setSaleDialogOpen(true);
      setDraggedClient(null);
      return;
    }

    // Update status in database
    try {
      const { error } = await supabase
        .from('clients')
        .update({ status: columnId })
        .eq('id', draggedClient.id);

      if (error) throw error;
      toast.success('Status atualizado!');
      onRefresh();
    } catch (error) {
      console.error('Error updating client status:', error);
      toast.error('Erro ao atualizar status');
    }

    stopScroll();
    setDraggedClient(null);
    setDragOverColumn(null);
  };

  const handleSaleComplete = () => {
    setSaleDialogOpen(false);
    setClientForSale(null);
    onRefresh();
  };

  return (
    <>
      <div className="mb-3">
        <BulkActionsBar
          active={selectionMode}
          selectedCount={selectedIds.size}
          totalCount={clients.length}
          columns={columns.map((c) => ({ id: c.id, title: c.title }))}
          onToggleActive={() => {
            setSelectionMode((v) => !v);
            if (selectionMode) setSelectedIds(new Set());
          }}
          onSelectAll={handleSelectAll}
          onClearSelection={() => setSelectedIds(new Set())}
          onMoveTo={handleBulkMove}
        />
      </div>
      <ScrollArea className="w-full pb-4 client-kanban-scroll">
        <div className="flex gap-4 min-h-[600px] pb-4">
          {columns.map((column) => {
            const columnClients = getClientsForColumn(column.id);
            const Icon = column.icon;
            const columnIds = columnClients.map((c) => c.id);
            const colSelectedCount = columnIds.filter((id) => selectedIds.has(id)).length;
            const colAllSelected = columnIds.length > 0 && colSelectedCount === columnIds.length;

            const toggleColumnSelection = () => {
              setSelectedIds((prev) => {
                const next = new Set(prev);
                if (colAllSelected) columnIds.forEach((id) => next.delete(id));
                else columnIds.forEach((id) => next.add(id));
                return next;
              });
            };

            return (
              <div
                key={column.id}
                className={cn(
                  "flex flex-col bg-muted/30 rounded-xl border min-w-[280px] w-[280px] shrink-0 transition-colors",
                  dragOverColumn === column.id ? 'border-primary bg-primary/5' : 'border-border/50'
                )}
                onDragOver={(e) => handleDragOver(e, column.id)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, column.id)}
              >
                {/* Column Header */}
                {(() => {
                  const display = getColumnDisplay(column);
                  return (
                    <div className={cn(
                      "flex flex-col px-3 py-3 border-b rounded-t-xl",
                      column.color
                    )}>
                      <div className="flex items-center gap-2">
                        <Icon className="w-4 h-4 shrink-0" />
                        <span className="font-medium text-sm truncate">{display.title}</span>
                        <span className="bg-background/80 text-foreground px-2 py-0.5 rounded-full text-xs font-medium shrink-0">
                          {columnClients.length}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 ml-auto opacity-60 hover:opacity-100"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingColumn(column.id);
                          }}
                        >
                          <Settings className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                      {display.subtitle && (
                        <span className="text-xs opacity-80 mt-0.5 pl-6">{display.subtitle}</span>
                      )}
                      {selectionMode && columnClients.length > 0 && (
                        <button
                          type="button"
                          onClick={toggleColumnSelection}
                          className="mt-2 flex items-center gap-2 text-xs font-medium hover:underline"
                        >
                          <Checkbox checked={colAllSelected} className="pointer-events-none" />
                          {colAllSelected ? 'Desmarcar coluna' : 'Selecionar coluna'}
                        </button>
                      )}
                    </div>
                  );
                })()}

                {/* Column Content */}
                <div className="flex-1 p-2 space-y-2 overflow-y-auto max-h-[calc(100vh-300px)]">
                  {columnClients.map((client) => {
                    const isSelected = selectedIds.has(client.id);
                    return (
                      <div
                        key={client.id}
                        draggable={!selectionMode}
                        onDragStart={(e) => !selectionMode && handleDragStart(e, client)}
                        onDragEnd={handleDragEnd}
                        onClick={(e) => {
                          if (selectionMode) {
                            e.stopPropagation();
                            e.preventDefault();
                            toggleSelected(client.id);
                            return;
                          }
                          if (isDraggingRef.current) {
                            e.stopPropagation();
                            e.preventDefault();
                          }
                        }}
                        className={cn(
                          "relative transition-opacity",
                          selectionMode ? 'cursor-pointer' : 'cursor-grab active:cursor-grabbing',
                          draggedClient?.id === client.id && "opacity-50",
                          isSelected && selectionMode && 'ring-2 ring-primary rounded-xl'
                        )}
                      >
                        {selectionMode && (
                          <div className="absolute top-2 left-2 z-10 bg-background rounded p-0.5 shadow">
                            <Checkbox checked={isSelected} className="pointer-events-none" />
                          </div>
                        )}
                        <ClientCard
                          client={client}
                          lastCallDate={client.lastCallDate}
                          onUpdate={onRefresh}
                        />
                      </div>
                    );
                  })}
                  
                  {columnClients.length === 0 && (
                    <div className="flex items-center justify-center h-24 text-muted-foreground text-xs border-2 border-dashed border-border/50 rounded-lg">
                      Arraste clientes aqui
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>


      {/* Sale Dialog */}
      {clientForSale && (
        <SaleFormDialog
          client={clientForSale}
          open={saleDialogOpen}
          onOpenChange={(open) => {
            setSaleDialogOpen(open);
            if (!open) setClientForSale(null);
          }}
          onSaleUpdated={handleSaleComplete}
        />
      )}

      {/* Column Settings Dialog */}
      {editingColumn && (() => {
        const column = columns.find(c => c.id === editingColumn);
        if (!column) return null;
        return (
          <ColumnSettingsDialog
            open={!!editingColumn}
            onOpenChange={(open) => !open && setEditingColumn(null)}
            columnId={column.id}
            defaultTitle={column.title}
            defaultSubtitle={column.subtitle}
            onSave={fetchSettings}
          />
        );
      })()}
    </>
  );
}
