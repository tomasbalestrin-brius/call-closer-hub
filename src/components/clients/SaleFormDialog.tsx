import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Client } from '@/types';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2 } from 'lucide-react';

interface SaleFormDialogProps {
  client: Client;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaleUpdated: () => void;
}

export default function SaleFormDialog({ 
  client, 
  open, 
  onOpenChange, 
  onSaleUpdated 
}: SaleFormDialogProps) {
  const [loading, setLoading] = useState(false);
  
  const [saleValue, setSaleValue] = useState(client.sale_value?.toString() || '');
  const [entryValue, setEntryValue] = useState(client.entry_value?.toString() || '');
  const [negotiationNotes, setNegotiationNotes] = useState(client.negotiation_notes || '');
  const [contractValidity, setContractValidity] = useState(client.contract_validity || '');
  const [saleNotes, setSaleNotes] = useState(client.sale_notes || '');

  useEffect(() => {
    if (open) {
      setSaleValue(client.sale_value?.toString() || '');
      setEntryValue(client.entry_value?.toString() || '');
      setNegotiationNotes(client.negotiation_notes || '');
      setContractValidity(client.contract_validity || '');
      setSaleNotes(client.sale_notes || '');
    }
  }, [open, client]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setLoading(true);
    try {
      const { error } = await supabase
        .from('clients')
        .update({
          is_sold: true,
          sold_at: client.is_sold ? client.sold_at : new Date().toISOString(),
          sale_value: saleValue ? parseFloat(saleValue) : null,
          entry_value: entryValue ? parseFloat(entryValue) : null,
          negotiation_notes: negotiationNotes.trim() || null,
          contract_validity: contractValidity.trim() || null,
          sale_notes: saleNotes.trim() || null,
          status: 'venda_realizada',
        })
        .eq('id', client.id);

      if (error) throw error;

      // Fire sale webhook asynchronously (don't block UI)
      supabase.functions.invoke('send-sale-webhook', {
        body: { client_id: client.id },
      }).catch((err) => console.warn('Webhook error (non-blocking):', err));

      toast.success('Venda registrada!');
      onOpenChange(false);
      onSaleUpdated();
    } catch (error) {
      console.error('Error registering sale:', error);
      toast.error('Erro ao registrar venda');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveSale = async () => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('clients')
        .update({
          is_sold: false,
          sold_at: null,
          sale_value: null,
          entry_value: null,
          negotiation_notes: null,
          contract_validity: null,
          sale_notes: null,
          status: 'call_realizada',
        })
        .eq('id', client.id);

      if (error) throw error;

      toast.success('Venda removida!');
      onOpenChange(false);
      onSaleUpdated();
    } catch (error) {
      console.error('Error removing sale:', error);
      toast.error('Erro ao remover venda');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {client.is_sold ? 'Editar Venda' : 'Registrar Venda'}
          </DialogTitle>
          <DialogDescription>
            Preencha os detalhes da venda realizada
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="saleValue">Valor da Venda (R$)</Label>
              <Input
                id="saleValue"
                type="number"
                value={saleValue}
                onChange={(e) => setSaleValue(e.target.value)}
                placeholder="0,00"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="entryValue">Valor de Entrada (R$)</Label>
              <Input
                id="entryValue"
                type="number"
                value={entryValue}
                onChange={(e) => setEntryValue(e.target.value)}
                placeholder="0,00"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="contractValidity">Vigência do Contrato</Label>
            <Input
              id="contractValidity"
              value={contractValidity}
              onChange={(e) => setContractValidity(e.target.value)}
              placeholder="Ex: 12 meses, 1 ano, etc."
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="negotiationNotes">Como foi a Negociação</Label>
            <Textarea
              id="negotiationNotes"
              value={negotiationNotes}
              onChange={(e) => setNegotiationNotes(e.target.value)}
              rows={3}
              placeholder="Descreva como foi o processo de negociação..."
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="saleNotes">Notas da Venda</Label>
            <Textarea
              id="saleNotes"
              value={saleNotes}
              onChange={(e) => setSaleNotes(e.target.value)}
              rows={2}
              placeholder="Observações adicionais sobre a venda..."
            />
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            {client.is_sold && (
              <Button 
                type="button" 
                variant="destructive" 
                onClick={handleRemoveSale}
                disabled={loading}
              >
                Remover Venda
              </Button>
            )}
            <div className="flex gap-2 ml-auto">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={loading}>
                {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Salvar
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
