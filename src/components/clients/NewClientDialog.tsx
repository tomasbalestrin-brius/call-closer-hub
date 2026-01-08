import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

interface NewClientDialogProps {
  onClientCreated: () => void;
}

const FUNNEL_SOURCES = [
  'YouTube - Orgânico',
  'YouTube - Ads',
  'Instagram - Orgânico',
  'Instagram - Ads',
  'Facebook - Orgânico',
  'Facebook - Ads',
  'TikTok - Orgânico',
  'TikTok - Ads',
  'Google - Orgânico',
  'Google - Ads',
  'LinkedIn - Orgânico',
  'LinkedIn - Ads',
  'Indicação',
  'Podcast',
  'Evento Presencial',
  'Evento Online',
  'Webinar',
  'E-book/Lead Magnet',
  'Blog',
  'E-mail Marketing',
  'WhatsApp',
  'Outro'
];

const SDR_OPTIONS = [
  'Thalita',
  'Letícia',
  'Julia',
  'Larissa',
  'Outro'
];

const PRODUCT_OPTIONS = [
  'Elite',
  'Elite VIP',
  'Start',
  'Imersão',
  'Mentoria Individual',
  'Outro'
];

export default function NewClientDialog({ onClientCreated }: NewClientDialogProps) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  
  // Contact fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  
  // Business fields
  const [company, setCompany] = useState('');
  const [niche, setNiche] = useState('');
  const [revenue, setRevenue] = useState('');
  const [hasPartner, setHasPartner] = useState(false);
  const [funnelSource, setFunnelSource] = useState('');
  const [sdrName, setSdrName] = useState('');
  const [productOffered, setProductOffered] = useState('');
  
  // Additional fields
  const [mainPain, setMainPain] = useState('');
  const [notes, setNotes] = useState('');
  const [followupDate, setFollowupDate] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) {
      toast.error('Você precisa estar logado');
      return;
    }

    if (!name.trim()) {
      toast.error('Nome do cliente é obrigatório');
      return;
    }

    setLoading(true);

    const { error } = await supabase.from('clients').insert({
      closer_id: user.id,
      name: name.trim(),
      email: email || null,
      phone: phone || null,
      company: company || null,
      niche: niche.trim() || null,
      revenue: revenue ? parseFloat(revenue) : null,
      has_partner: hasPartner,
      funnel_source: funnelSource || null,
      sdr_name: sdrName || null,
      product_offered: productOffered || null,
      main_pain: mainPain.trim() || null,
      notes: notes || null,
      followup_date: followupDate || null,
    });

    setLoading(false);

    if (error) {
      toast.error('Erro ao criar cliente');
      console.error(error);
    } else {
      toast.success('Cliente criado com sucesso!');
      setOpen(false);
      resetForm();
      onClientCreated();
    }
  };

  const resetForm = () => {
    setName('');
    setEmail('');
    setPhone('');
    setCompany('');
    setNiche('');
    setRevenue('');
    setHasPartner(false);
    setFunnelSource('');
    setSdrName('');
    setProductOffered('');
    setMainPain('');
    setNotes('');
    setFollowupDate('');
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gradient-primary">
          <Plus className="w-4 h-4 mr-2" />
          Novo Cliente
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display">Novo Cliente</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Contact Section */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-muted-foreground">Contato</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 space-y-2">
                <Label htmlFor="name">Nome *</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Nome do cliente"
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="phone">Telefone</Label>
                <Input
                  id="phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="(11) 99999-9999"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
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

          {/* Business Section */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-muted-foreground">Negócio</h3>
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
                  placeholder="Ex: Coaching, Consultoria..."
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="revenue">Faturamento Mensal (R$)</Label>
                <Input
                  id="revenue"
                  type="number"
                  step="0.01"
                  value={revenue}
                  onChange={(e) => setRevenue(e.target.value)}
                  placeholder="0,00"
                />
              </div>
              
              <div className="space-y-2 flex items-end">
                <div className="flex items-center space-x-2 pb-2">
                  <Checkbox
                    id="hasPartner"
                    checked={hasPartner}
                    onCheckedChange={(checked) => setHasPartner(checked === true)}
                  />
                  <Label htmlFor="hasPartner" className="cursor-pointer">
                    Tem sócio
                  </Label>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="funnelSource">Funil de Origem</Label>
                <Select value={funnelSource} onValueChange={setFunnelSource}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    {FUNNEL_SOURCES.map((source) => (
                      <SelectItem key={source} value={source}>
                        {source}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="sdrName">SDR</Label>
                <Select value={sdrName} onValueChange={setSdrName}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    {SDR_OPTIONS.map((sdr) => (
                      <SelectItem key={sdr} value={sdr}>
                        {sdr}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="col-span-2 space-y-2">
                <Label htmlFor="productOffered">Produto Ofertado</Label>
                <Select value={productOffered} onValueChange={setProductOffered}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    {PRODUCT_OPTIONS.map((product) => (
                      <SelectItem key={product} value={product}>
                        {product}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Additional Section */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-muted-foreground">Informações Adicionais</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 space-y-2">
                <Label htmlFor="mainPain">Dor Principal</Label>
                <Textarea
                  id="mainPain"
                  value={mainPain}
                  onChange={(e) => setMainPain(e.target.value)}
                  placeholder="Qual a principal dor/problema do cliente..."
                  rows={2}
                />
              </div>
              
              <div className="col-span-2 space-y-2">
                <Label htmlFor="notes">Observações</Label>
                <Textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Informações adicionais sobre o cliente..."
                  rows={2}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="followupDate">Data de Follow-up</Label>
                <Input
                  id="followupDate"
                  type="date"
                  value={followupDate}
                  onChange={(e) => setFollowupDate(e.target.value)}
                />
              </div>
            </div>
          </div>
          
          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" className="gradient-primary" disabled={loading}>
              {loading ? 'Salvando...' : 'Salvar Cliente'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
