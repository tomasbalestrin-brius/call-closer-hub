import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import type { CallStatus } from '@/types';

interface NewCallDialogProps {
  onCallCreated: () => void;
}

export default function NewCallDialog({ onCallCreated }: NewCallDialogProps) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  
  const [clientName, setClientName] = useState('');
  const [callDate, setCallDate] = useState(new Date().toISOString().split('T')[0]);
  const [callTime, setCallTime] = useState('');
  const [product, setProduct] = useState('');
  const [status, setStatus] = useState<CallStatus>('pendente');
  const [score, setScore] = useState('');
  const [notes, setNotes] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) {
      toast.error('Você precisa estar logado');
      return;
    }

    if (!clientName.trim()) {
      toast.error('Nome do cliente é obrigatório');
      return;
    }

    setLoading(true);

    const { error } = await supabase.from('calls').insert({
      closer_id: user.id,
      client_name: clientName.trim(),
      call_date: callDate,
      call_time: callTime || null,
      product: product || null,
      status,
      score: score ? parseInt(score) : null,
      notes: notes || null,
    });

    setLoading(false);

    if (error) {
      toast.error('Erro ao criar call');
      console.error(error);
    } else {
      toast.success('Call criada com sucesso!');
      setOpen(false);
      resetForm();
      onCallCreated();
    }
  };

  const resetForm = () => {
    setClientName('');
    setCallDate(new Date().toISOString().split('T')[0]);
    setCallTime('');
    setProduct('');
    setStatus('pendente');
    setScore('');
    setNotes('');
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gradient-primary">
          <Plus className="w-4 h-4 mr-2" />
          Nova Call
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="font-display">Nova Call</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 space-y-2">
              <Label htmlFor="clientName">Nome do Cliente *</Label>
              <Input
                id="clientName"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="Ex: João Silva"
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="callDate">Data</Label>
              <Input
                id="callDate"
                type="date"
                value={callDate}
                onChange={(e) => setCallDate(e.target.value)}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="callTime">Horário</Label>
              <Input
                id="callTime"
                type="time"
                value={callTime}
                onChange={(e) => setCallTime(e.target.value)}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="product">Produto</Label>
              <Input
                id="product"
                value={product}
                onChange={(e) => setProduct(e.target.value)}
                placeholder="Ex: Mentoria Premium"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as CallStatus)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pendente">Pendente</SelectItem>
                  <SelectItem value="em_andamento">Em andamento</SelectItem>
                  <SelectItem value="follow_up">Follow-up</SelectItem>
                  <SelectItem value="proposta_enviada">Proposta enviada</SelectItem>
                  <SelectItem value="vendido">Vendido</SelectItem>
                  <SelectItem value="perdido">Perdido</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="col-span-2 space-y-2">
              <Label htmlFor="score">Nota (1-10)</Label>
              <Input
                id="score"
                type="number"
                min="1"
                max="10"
                value={score}
                onChange={(e) => setScore(e.target.value)}
                placeholder="Avaliação da call"
              />
            </div>
            
            <div className="col-span-2 space-y-2">
              <Label htmlFor="notes">Observações</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Anotações sobre a call..."
                rows={3}
              />
            </div>
          </div>
          
          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" className="gradient-primary" disabled={loading}>
              {loading ? 'Salvando...' : 'Salvar Call'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
