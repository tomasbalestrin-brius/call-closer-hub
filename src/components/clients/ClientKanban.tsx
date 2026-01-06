import { useState } from 'react';
import { Client } from '@/types';
import ClientCard from './ClientCard';
import SaleFormDialog from './SaleFormDialog';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Phone, Calendar, TrendingUp, CheckCircle2 } from 'lucide-react';

const KANBAN_COLUMNS = [
  { 
    id: 'call_realizada', 
    title: 'Call Realizada', 
    icon: Phone,
    color: 'bg-blue-500/10 border-blue-500/30 text-blue-600' 
  },
  { 
    id: 'contato_agendado', 
    title: 'Contato Agendado', 
    icon: Calendar,
    color: 'bg-yellow-500/10 border-yellow-500/30 text-yellow-600' 
  },
  { 
    id: 'encaminhado_fechamento', 
    title: 'Encaminhado Fechamento', 
    icon: TrendingUp,
    color: 'bg-purple-500/10 border-purple-500/30 text-purple-600' 
  },
  { 
    id: 'venda_realizada', 
    title: 'Venda Realizada', 
    icon: CheckCircle2,
    color: 'bg-green-500/10 border-green-500/30 text-green-600' 
  },
];

interface ClientKanbanProps {
  clients: Client[];
  onRefresh: () => void;
}

export default function ClientKanban({ clients, onRefresh }: ClientKanbanProps) {
  const [draggedClient, setDraggedClient] = useState<Client | null>(null);
  const [saleDialogOpen, setSaleDialogOpen] = useState(false);
  const [clientForSale, setClientForSale] = useState<Client | null>(null);

  const getClientsForColumn = (columnId: string) => {
    if (columnId === 'venda_realizada') {
      return clients.filter(c => c.is_sold || c.status === 'venda_realizada');
    }
    return clients.filter(c => !c.is_sold && (c.status || 'call_realizada') === columnId);
  };

  const handleDragStart = (e: React.DragEvent, client: Client) => {
    setDraggedClient(client);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
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

    setDraggedClient(null);
  };

  const handleSaleComplete = () => {
    setSaleDialogOpen(false);
    setClientForSale(null);
    onRefresh();
  };

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 min-h-[600px]">
        {KANBAN_COLUMNS.map((column) => {
          const columnClients = getClientsForColumn(column.id);
          const Icon = column.icon;
          
          return (
            <div
              key={column.id}
              className="flex flex-col bg-muted/30 rounded-xl border border-border/50"
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, column.id)}
            >
              {/* Column Header */}
              <div className={cn(
                "flex items-center gap-2 px-4 py-3 border-b rounded-t-xl",
                column.color
              )}>
                <Icon className="w-4 h-4" />
                <span className="font-medium text-sm">{column.title}</span>
                <span className="ml-auto bg-background/80 text-foreground px-2 py-0.5 rounded-full text-xs font-medium">
                  {columnClients.length}
                </span>
              </div>

              {/* Column Content */}
              <div className="flex-1 p-2 space-y-2 overflow-y-auto max-h-[calc(100vh-300px)]">
                {columnClients.map((client) => (
                  <div
                    key={client.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, client)}
                    className={cn(
                      "cursor-grab active:cursor-grabbing transition-opacity",
                      draggedClient?.id === client.id && "opacity-50"
                    )}
                  >
                    <ClientCard client={client} />
                  </div>
                ))}
                
                {columnClients.length === 0 && (
                  <div className="flex items-center justify-center h-24 text-muted-foreground text-sm border-2 border-dashed border-border/50 rounded-lg">
                    Arraste clientes aqui
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

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
    </>
  );
}
