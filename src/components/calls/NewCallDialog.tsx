import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { CallStatus } from '@/types';

interface NewCallDialogProps {
  onCallCreated: () => void;
}

export default function NewCallDialog({ onCallCreated }: NewCallDialogProps) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  
  // Client data
  const [clientName, setClientName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [niche, setNiche] = useState('');
  const [mainPain, setMainPain] = useState('');
  
  // Call data
  const [callDate, setCallDate] = useState(new Date().toISOString().split('T')[0]);
  const [callTime, setCallTime] = useState('');
  const [product, setProduct] = useState('');
  const [status, setStatus] = useState<CallStatus>('pendente');
  const [callConclusion, setCallConclusion] = useState('');
  const [observation, setObservation] = useState('');

  const resetForm = () => {
    setClientName('');
    setCompanyName('');
    setNiche('');
    setMainPain('');
    setCallDate(new Date().toISOString().split('T')[0]);
    setCallTime('');
    setProduct('');
    setStatus('pendente');
    setCallConclusion('');
    setObservation('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!clientName.trim()) {
      toast.error('Nome do cliente é obrigatório');
      return;
    }

    if (!user) {
      toast.error('Você precisa estar logado');
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.from('calls').insert({
        closer_id: user.id,
        client_name: clientName.trim(),
        company_name: companyName.trim() || null,
        call_date: callDate,
        call_time: callTime || null,
        product: product.trim() || null,
        status,
        niche: niche.trim() || null,
        main_pain: mainPain.trim() || null,
        call_conclusion: callConclusion.trim() || null,
        observation: observation.trim() || null,
      });

      if (error) throw error;

      toast.success('Call criada com sucesso!');
      resetForm();
      setOpen(false);
      onCallCreated();
    } catch (error) {
      console.error('Error creating call:', error);
      toast.error('Erro ao criar call');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gradient-primary">
          <Plus className="w-4 h-4 mr-2" />
          Nova Call
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display">Nova Call</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Dados do Cliente */}
          <div className="space-y-4">
            <h3 className="font-medium text-sm text-muted-foreground">Dados do Cliente</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="clientName">Nome do Cliente *</Label>
                <Input
                  id="clientName"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  placeholder="Nome completo"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="companyName">Nome da Empresa</Label>
                <Input
                  id="companyName"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="Empresa do cliente"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="niche">Nicho</Label>
                <Input
                  id="niche"
                  value={niche}
                  onChange={(e) => setNiche(e.target.value)}
                  placeholder="Nicho de atuação"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="mainPain">Dor Principal</Label>
              <Textarea
                id="mainPain"
                value={mainPain}
                onChange={(e) => setMainPain(e.target.value)}
                placeholder="Principal dor do cliente"
                rows={2}
              />
            </div>
          </div>

          {/* Dados da Call */}
          <div className="space-y-4">
            <h3 className="font-medium text-sm text-muted-foreground">Dados da Call</h3>
            <div className="grid grid-cols-2 gap-4">
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
                  placeholder="Produto oferecido"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select value={status} onValueChange={(value) => setStatus(value as CallStatus)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pendente">Pendente</SelectItem>
                    <SelectItem value="em_andamento">Em Andamento</SelectItem>
                    <SelectItem value="follow_up">Follow Up</SelectItem>
                    <SelectItem value="proposta_enviada">Proposta Enviada</SelectItem>
                    <SelectItem value="vendido">Vendido</SelectItem>
                    <SelectItem value="perdido">Perdido</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="callConclusion">Conclusão da Call</Label>
              <Textarea
                id="callConclusion"
                value={callConclusion}
                onChange={(e) => setCallConclusion(e.target.value)}
                placeholder="Como foi a conclusão da call"
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="observation">Observação</Label>
              <Textarea
                id="observation"
                value={observation}
                onChange={(e) => setObservation(e.target.value)}
                placeholder="Observações adicionais"
                rows={2}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2">
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
