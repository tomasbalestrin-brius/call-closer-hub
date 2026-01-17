import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Loader2,
  Merge,
  Phone,
  Calendar
} from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Call } from '@/types';
import { cn } from '@/lib/utils';

interface MergeCallDialogProps {
  currentCall: Call;
  onMergeComplete: () => void;
}

export function MergeCallDialog({ currentCall, onMergeComplete }: MergeCallDialogProps) {
  const [open, setOpen] = useState(false);
  const [availableCalls, setAvailableCalls] = useState<Call[]>([]);
  const [selectedCallId, setSelectedCallId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [merging, setMerging] = useState(false);

  useEffect(() => {
    if (open) {
      fetchAvailableCalls();
    }
  }, [open, currentCall.id]);

  const fetchAvailableCalls = async () => {
    try {
      // Get calls from the same client that aren't already merged
      const { data, error } = await supabase
        .from('calls')
        .select('*')
        .eq('closer_id', currentCall.closer_id)
        .is('merged_with_call_id', null)
        .neq('id', currentCall.id)
        .order('call_date', { ascending: false });

      if (error) throw error;
      setAvailableCalls((data || []) as Call[]);
    } catch (error) {
      console.error('Error fetching calls:', error);
      toast.error('Erro ao carregar calls');
    } finally {
      setLoading(false);
    }
  };

  const handleMerge = async () => {
    if (!selectedCallId) {
      toast.error('Selecione uma call para juntar');
      return;
    }

    setMerging(true);
    try {
      // Call the merge-and-reanalyze edge function
      const { data, error } = await supabase.functions.invoke('merge-and-reanalyze', {
        body: {
          primaryCallId: currentCall.id,
          secondaryCallId: selectedCallId
        }
      });

      if (error) throw error;

      if (data.newScore !== undefined) {
        toast.success(`Calls unidas com sucesso! Nova nota: ${data.newScore}/10`);
      } else {
        toast.success('Calls unidas com sucesso!');
      }
      
      setOpen(false);
      onMergeComplete();
    } catch (error) {
      console.error('Error merging calls:', error);
      toast.error('Erro ao juntar e analisar calls');
    } finally {
      setMerging(false);
    }
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      pendente: 'Pendente',
      em_andamento: 'Em andamento',
      follow_up: 'Follow-up',
      proposta_enviada: 'Proposta enviada',
      vendido: 'Vendido',
      perdido: 'Perdido',
    };
    return labels[status] || status;
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Merge className="w-4 h-4 mr-2" />
          Juntar Call
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Merge className="w-5 h-5" />
            Juntar Calls
          </DialogTitle>
          <DialogDescription>
            Selecione uma call para unir com "{currentCall.client_name}".
            A call selecionada será marcada como mesclada.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 max-h-[400px] overflow-y-auto py-2">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : availableCalls.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhuma call disponível para juntar
            </div>
          ) : (
            availableCalls.map((call) => (
              <div
                key={call.id}
                onClick={() => setSelectedCallId(call.id)}
                className={cn(
                  "flex items-center justify-between p-4 rounded-lg border cursor-pointer transition-all",
                  selectedCallId === call.id 
                    ? "border-primary bg-primary/5" 
                    : "hover:border-muted-foreground/50"
                )}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <Phone className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h4 className="font-medium">{call.client_name}</h4>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Calendar className="w-3 h-3" />
                      {format(new Date(call.call_date), "dd/MM/yyyy", { locale: ptBR })}
                      {call.product && (
                        <span className="text-xs">• {call.product}</span>
                      )}
                    </div>
                  </div>
                </div>
                <Badge variant="outline">{getStatusLabel(call.status)}</Badge>
              </div>
            ))
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button 
            onClick={handleMerge} 
            disabled={merging || !selectedCallId}
          >
            {merging && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {merging ? 'Analisando...' : 'Juntar e Analisar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
