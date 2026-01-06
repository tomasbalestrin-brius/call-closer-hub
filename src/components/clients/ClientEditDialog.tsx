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
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Pencil, Loader2 } from 'lucide-react';

interface ClientEditDialogProps {
  client: Client;
  onClientUpdated: () => void;
}

export default function ClientEditDialog({ client, onClientUpdated }: ClientEditDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  
  const [name, setName] = useState(client.name);
  const [email, setEmail] = useState(client.email || '');
  const [phone, setPhone] = useState(client.phone || '');
  const [company, setCompany] = useState(client.company || '');
  const [niche, setNiche] = useState(client.niche || '');
  const [revenue, setRevenue] = useState(client.revenue?.toString() || '');
  const [hasPartner, setHasPartner] = useState(client.has_partner || false);
  const [mainPain, setMainPain] = useState(client.main_pain || '');
  const [mainDifficulty, setMainDifficulty] = useState(client.main_difficulty || '');
  const [notes, setNotes] = useState(client.notes || '');

  useEffect(() => {
    if (open) {
      setName(client.name);
      setEmail(client.email || '');
      setPhone(client.phone || '');
      setCompany(client.company || '');
      setNiche(client.niche || '');
      setRevenue(client.revenue?.toString() || '');
      setHasPartner(client.has_partner || false);
      setMainPain(client.main_pain || '');
      setMainDifficulty(client.main_difficulty || '');
      setNotes(client.notes || '');
    }
  }, [open, client]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) {
      toast.error('Nome é obrigatório');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from('clients')
        .update({
          name: name.trim(),
          email: email.trim() || null,
          phone: phone.trim() || null,
          company: company.trim() || null,
          niche: niche.trim() || null,
          revenue: revenue ? parseFloat(revenue) : null,
          has_partner: hasPartner,
          main_pain: mainPain.trim() || null,
          main_difficulty: mainDifficulty.trim() || null,
          notes: notes.trim() || null,
        })
        .eq('id', client.id);

      if (error) throw error;

      toast.success('Cliente atualizado!');
      setOpen(false);
      onClientUpdated();
    } catch (error) {
      console.error('Error updating client:', error);
      toast.error('Erro ao atualizar cliente');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Pencil className="w-4 h-4 mr-2" />
          Editar
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Cliente</DialogTitle>
          <DialogDescription>
            Atualize as informações do cliente
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome *</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="company">Empresa</Label>
              <Input
                id="company"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Telefone</Label>
              <Input
                id="phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="niche">Nicho</Label>
              <Input
                id="niche"
                value={niche}
                onChange={(e) => setNiche(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="revenue">Faturamento Mensal (R$)</Label>
              <Input
                id="revenue"
                type="number"
                value={revenue}
                onChange={(e) => setRevenue(e.target.value)}
              />
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="hasPartner"
              checked={hasPartner}
              onCheckedChange={setHasPartner}
            />
            <Label htmlFor="hasPartner">Tem sócio</Label>
          </div>

          <div className="space-y-2">
            <Label htmlFor="mainPain">Dor Principal</Label>
            <Textarea
              id="mainPain"
              value={mainPain}
              onChange={(e) => setMainPain(e.target.value)}
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="mainDifficulty">Maior Dificuldade</Label>
            <Textarea
              id="mainDifficulty"
              value={mainDifficulty}
              onChange={(e) => setMainDifficulty(e.target.value)}
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notas Gerais</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
