import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Pencil, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Client, FUNNEL_SOURCES, SDR_NAMES, PRODUCTS_OFFERED } from '@/types';

interface ClientEditDialogProps {
  client: Client;
  onClientUpdated: () => void;
}

export default function ClientEditDialog({ client, onClientUpdated }: ClientEditDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  
  // Client data
  const [name, setName] = useState(client.name);
  const [company, setCompany] = useState(client.company || '');
  const [email, setEmail] = useState(client.email || '');
  const [phone, setPhone] = useState(client.phone || '');
  const [niche, setNiche] = useState(client.niche || '');
  const [revenue, setRevenue] = useState(client.revenue?.toString() || '');
  const [hasPartner, setHasPartner] = useState(client.has_partner || false);
  const [mainPain, setMainPain] = useState(client.main_pain || '');
  const [mainDifficulty, setMainDifficulty] = useState(client.main_difficulty || '');
  const [notes, setNotes] = useState(client.notes || '');
  
  // New fields
  const [funnelSource, setFunnelSource] = useState(client.funnel_source || '');
  const [sdrName, setSdrName] = useState(client.sdr_name || '');
  const [productOffered, setProductOffered] = useState(client.product_offered || '');
  const [followupDate, setFollowupDate] = useState(client.followup_date || '');

  useEffect(() => {
    if (open) {
      setName(client.name);
      setCompany(client.company || '');
      setEmail(client.email || '');
      setPhone(client.phone || '');
      setNiche(client.niche || '');
      setRevenue(client.revenue?.toString() || '');
      setHasPartner(client.has_partner || false);
      setMainPain(client.main_pain || '');
      setMainDifficulty(client.main_difficulty || '');
      setNotes(client.notes || '');
      setFunnelSource(client.funnel_source || '');
      setSdrName(client.sdr_name || '');
      setProductOffered(client.product_offered || '');
      setFollowupDate(client.followup_date || '');
    }
  }, [open, client]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) {
      toast.error('Nome do cliente é obrigatório');
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase
        .from('clients')
        .update({
          name: name.trim(),
          company: company.trim() || null,
          email: email.trim() || null,
          phone: phone.trim() || null,
          niche: niche.trim() || null,
          revenue: revenue ? parseFloat(revenue) : null,
          has_partner: hasPartner,
          main_pain: mainPain.trim() || null,
          main_difficulty: mainDifficulty.trim() || null,
          notes: notes.trim() || null,
          funnel_source: funnelSource || null,
          sdr_name: sdrName || null,
          product_offered: productOffered || null,
          followup_date: followupDate || null,
        })
        .eq('id', client.id);

      if (error) throw error;

      toast.success('Cliente atualizado com sucesso!');
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
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Dados de Contato */}
          <div className="space-y-4">
            <h3 className="font-medium text-sm text-muted-foreground">Contato</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome *</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Nome completo"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Telefone</Label>
                <Input
                  id="phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="(00) 00000-0000"
                />
              </div>
              <div className="col-span-2 space-y-2">
                <Label htmlFor="email">E-mail</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="email@exemplo.com"
                />
              </div>
            </div>
          </div>

          {/* Dados do Negócio */}
          <div className="space-y-4">
            <h3 className="font-medium text-sm text-muted-foreground">Negócio</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="company">Empresa</Label>
                <Input
                  id="company"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  placeholder="Nome da empresa"
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
              <div className="space-y-2">
                <Label htmlFor="revenue">Faturamento Mensal</Label>
                <Input
                  id="revenue"
                  type="number"
                  value={revenue}
                  onChange={(e) => setRevenue(e.target.value)}
                  placeholder="Faturamento mensal"
                />
              </div>
              <div className="flex items-center gap-2 pt-6">
                <Switch
                  id="hasPartner"
                  checked={hasPartner}
                  onCheckedChange={setHasPartner}
                />
                <Label htmlFor="hasPartner">Tem Sócio</Label>
              </div>
              <div className="space-y-2">
                <Label htmlFor="funnelSource">Funil de Origem</Label>
                <Select value={funnelSource || "none"} onValueChange={(val) => setFunnelSource(val === "none" ? "" : val)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o funil" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum</SelectItem>
                    {FUNNEL_SOURCES.map((source) => (
                      <SelectItem key={source} value={source}>
                        {source}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="sdrName">SDR que Agendou</Label>
                <Select value={sdrName || "none"} onValueChange={(val) => setSdrName(val === "none" ? "" : val)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o SDR" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum</SelectItem>
                    {SDR_NAMES.map((sdr) => (
                      <SelectItem key={sdr} value={sdr}>
                        {sdr}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="productOffered">Produto Ofertado</Label>
                <Select value={productOffered || "none"} onValueChange={(val) => setProductOffered(val === "none" ? "" : val)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o produto" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum</SelectItem>
                    {PRODUCTS_OFFERED.map((product) => (
                      <SelectItem key={product} value={product}>
                        {product}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="followupDate">Data do Follow-up</Label>
                <Input
                  id="followupDate"
                  type="date"
                  value={followupDate}
                  onChange={(e) => setFollowupDate(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Dores e Dificuldades */}
          <div className="space-y-4">
            <h3 className="font-medium text-sm text-muted-foreground">Dores e Dificuldades</h3>
            <div className="space-y-4">
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
              <div className="space-y-2">
                <Label htmlFor="mainDifficulty">Dificuldade Principal</Label>
                <Textarea
                  id="mainDifficulty"
                  value={mainDifficulty}
                  onChange={(e) => setMainDifficulty(e.target.value)}
                  placeholder="Principal dificuldade"
                  rows={2}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes">Observações Gerais</Label>
                <Textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Anotações adicionais"
                  rows={3}
                />
              </div>
            </div>
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
