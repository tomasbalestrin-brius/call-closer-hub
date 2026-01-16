import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Plus, FileEdit, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useFormPersistence } from '@/hooks/useFormPersistence';
import { toast } from 'sonner';
import { FUNNEL_SOURCES, SDR_NAMES, PRODUCTS_OFFERED } from '@/types';

interface NewClientDialogProps {
  onClientCreated: () => void;
}

interface NewClientFormData {
  name: string;
  email: string;
  phone: string;
  company: string;
  niche: string;
  revenue: string;
  hasPartner: boolean;
  funnelSource: string;
  sdrName: string;
  productOffered: string;
  mainPain: string;
  notes: string;
  followupDate: string;
}

const initialFormData: NewClientFormData = {
  name: '',
  email: '',
  phone: '',
  company: '',
  niche: '',
  revenue: '',
  hasPartner: false,
  funnelSource: '',
  sdrName: '',
  productOffered: '',
  mainPain: '',
  notes: '',
  followupDate: '',
};

export default function NewClientDialog({ onClientCreated }: NewClientDialogProps) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const {
    formData,
    updateField,
    clearSavedData,
    hasUnsavedData,
    hasSavedDraft,
  } = useFormPersistence<NewClientFormData>({
    key: 'new_client_draft',
    initialValue: initialFormData,
    userId: user?.id,
  });

  // Warn user before navigating away with unsaved data
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (open && hasUnsavedData()) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [open, hasUnsavedData]);

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen && hasUnsavedData()) {
      toast.info('Rascunho salvo automaticamente', {
        description: 'Você pode continuar o preenchimento depois',
      });
    }
    setOpen(newOpen);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) {
      toast.error('Você precisa estar logado');
      return;
    }

    if (!formData.name.trim()) {
      toast.error('Nome do cliente é obrigatório');
      return;
    }

    setLoading(true);

    const { error } = await supabase.from('clients').insert({
      closer_id: user.id,
      name: formData.name.trim(),
      email: formData.email || null,
      phone: formData.phone || null,
      company: formData.company || null,
      niche: formData.niche.trim() || null,
      revenue: formData.revenue ? parseFloat(formData.revenue) : null,
      has_partner: formData.hasPartner,
      funnel_source: formData.funnelSource || null,
      sdr_name: formData.sdrName || null,
      product_offered: formData.productOffered || null,
      main_pain: formData.mainPain.trim() || null,
      notes: formData.notes || null,
      followup_date: formData.followupDate || null,
    });

    setLoading(false);

    if (error) {
      toast.error('Erro ao criar cliente');
      console.error(error);
    } else {
      toast.success('Cliente criado com sucesso!');
      clearSavedData();
      setOpen(false);
      onClientCreated();
    }
  };

  const handleClearDraft = () => {
    clearSavedData();
    toast.success('Rascunho removido');
  };

  const showDraftBadge = hasSavedDraft() && hasUnsavedData();

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button className="gradient-primary">
          <Plus className="w-4 h-4 mr-2" />
          Novo Cliente
          {showDraftBadge && (
            <Badge variant="secondary" className="ml-2 bg-amber-500/20 text-amber-600">
              <FileEdit className="w-3 h-3 mr-1" />
              Rascunho
            </Badge>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="font-display flex items-center gap-2">
              Novo Cliente
              {showDraftBadge && (
                <Badge variant="outline" className="text-amber-600 border-amber-500">
                  <FileEdit className="w-3 h-3 mr-1" />
                  Rascunho
                </Badge>
              )}
            </DialogTitle>
            {showDraftBadge && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleClearDraft}
                className="text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="w-4 h-4 mr-1" />
                Limpar Rascunho
              </Button>
            )}
          </div>
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
                  value={formData.name}
                  onChange={(e) => updateField('name', e.target.value)}
                  placeholder="Nome do cliente"
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="phone">Telefone</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => updateField('phone', e.target.value)}
                  placeholder="(11) 99999-9999"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => updateField('email', e.target.value)}
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
                  value={formData.company}
                  onChange={(e) => updateField('company', e.target.value)}
                  placeholder="Nome da empresa"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="niche">Nicho</Label>
                <Input
                  id="niche"
                  value={formData.niche}
                  onChange={(e) => updateField('niche', e.target.value)}
                  placeholder="Ex: Coaching, Consultoria..."
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="revenue">Faturamento Mensal (R$)</Label>
                <Input
                  id="revenue"
                  type="number"
                  step="0.01"
                  value={formData.revenue}
                  onChange={(e) => updateField('revenue', e.target.value)}
                  placeholder="0,00"
                />
              </div>
              
              <div className="space-y-2 flex items-end">
                <div className="flex items-center space-x-2 pb-2">
                  <Checkbox
                    id="hasPartner"
                    checked={formData.hasPartner}
                    onCheckedChange={(checked) => updateField('hasPartner', checked === true)}
                  />
                  <Label htmlFor="hasPartner" className="cursor-pointer">
                    Tem sócio
                  </Label>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="funnelSource">Funil de Origem</Label>
                <Select value={formData.funnelSource || "none"} onValueChange={(val) => updateField('funnelSource', val === "none" ? "" : val)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione..." />
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
                <Label htmlFor="sdrName">SDR</Label>
                <Select value={formData.sdrName || "none"} onValueChange={(val) => updateField('sdrName', val === "none" ? "" : val)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione..." />
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
              
              <div className="col-span-2 space-y-2">
                <Label htmlFor="productOffered">Produto Ofertado</Label>
                <Select value={formData.productOffered || "none"} onValueChange={(val) => updateField('productOffered', val === "none" ? "" : val)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione..." />
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
                  value={formData.mainPain}
                  onChange={(e) => updateField('mainPain', e.target.value)}
                  placeholder="Qual a principal dor/problema do cliente..."
                  rows={2}
                />
              </div>
              
              <div className="col-span-2 space-y-2">
                <Label htmlFor="notes">Observações</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => updateField('notes', e.target.value)}
                  placeholder="Informações adicionais sobre o cliente..."
                  rows={2}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="followupDate">Data de Follow-up</Label>
                <Input
                  id="followupDate"
                  type="date"
                  value={formData.followupDate}
                  onChange={(e) => updateField('followupDate', e.target.value)}
                />
              </div>
            </div>
          </div>
          
          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
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
