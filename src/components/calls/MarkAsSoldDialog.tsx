import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Call } from '@/types';
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
import { Loader2, DollarSign } from 'lucide-react';

interface Props {
  call: Call;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSaved: () => void;
}

export function MarkAsSoldDialog({ call, open, onOpenChange, onSaved }: Props) {
  const isEditing = call.status === 'vendido';
  const [loading, setLoading] = useState(false);
  const [saleValue, setSaleValue] = useState('');
  const [entryValue, setEntryValue] = useState('');

  useEffect(() => {
    if (open) {
      setSaleValue(call.sale_value?.toString() || '');
      setEntryValue(call.entry_value?.toString() || '');
    }
  }, [open, call]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const sv = saleValue ? parseFloat(saleValue) : null;
      const ev = entryValue ? parseFloat(entryValue) : null;

      const { error: callErr } = await supabase
        .from('calls')
        .update({ status: 'vendido', sale_value: sv, entry_value: ev })
        .eq('id', call.id);
      if (callErr) throw callErr;

      if (call.client_id) {
        const { error: cliErr } = await supabase
          .from('clients')
          .update({
            is_sold: true,
            sold_at: new Date().toISOString(),
            sale_value: sv,
            entry_value: ev,
            status: 'venda_realizada',
          })
          .eq('id', call.client_id);
        if (cliErr) console.warn('client update failed', cliErr);

        supabase.functions
          .invoke('send-sale-webhook', { body: { client_id: call.client_id } })
          .catch((err) => console.warn('webhook failed', err));
      }

      toast.success(isEditing ? 'Venda atualizada!' : 'Call marcada como vendida!');
      onOpenChange(false);
      onSaved();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Erro ao salvar venda');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" onClick={(e) => e.stopPropagation()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-success" />
            {isEditing ? 'Editar Venda' : 'Marcar como Vendida'}
          </DialogTitle>
          <DialogDescription>
            Informe os valores da venda de <strong>{call.client_name}</strong>
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="saleValue">Valor da Venda (R$)</Label>
              <Input
                id="saleValue"
                type="number"
                step="0.01"
                value={saleValue}
                onChange={(e) => setSaleValue(e.target.value)}
                placeholder="0,00"
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="entryValue">Entrada (R$)</Label>
              <Input
                id="entryValue"
                type="number"
                step="0.01"
                value={entryValue}
                onChange={(e) => setEntryValue(e.target.value)}
                placeholder="0,00"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {isEditing ? 'Salvar' : 'Confirmar Venda'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
