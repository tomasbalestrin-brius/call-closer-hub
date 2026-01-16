import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
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
import { Pencil, Loader2, FileEdit, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useFormPersistence } from '@/hooks/useFormPersistence';
import { toast } from 'sonner';
import { Client, FUNNEL_SOURCES, SDR_NAMES, PRODUCTS_OFFERED } from '@/types';

interface ClientEditDialogProps {
  client: Client;
  onClientUpdated: () => void;
}

interface ClientEditFormData {
  name: string;
  company: string;
  email: string;
  phone: string;
  niche: string;
  revenue: string;
  hasPartner: boolean;
  mainPain: string;
  mainDifficulty: string;
  notes: string;
  funnelSource: string;
  sdrName: string;
  productOffered: string;
  followupDate: string;
}

export default function ClientEditDialog({ client, onClientUpdated }: ClientEditDialogProps) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  // Create initial form data from client
  const initialFormData = useMemo<ClientEditFormData>(() => ({
    name: client.name,
    company: client.company || '',
    email: client.email || '',
    phone: client.phone || '',
    niche: client.niche || '',
    revenue: client.revenue?.toString() || '',
    hasPartner: client.has_partner || false,
    mainPain: client.main_pain || '',
    mainDifficulty: client.main_difficulty || '',
    notes: client.notes || '',
    funnelSource: client.funnel_source || '',
    sdrName: client.sdr_name || '',
    productOffered: client.product_offered || '',
    followupDate: client.followup_date || '',
  }), [client]);

  const {
    formData,
    setFormData,
    updateField,
    clearSavedData,
    hasUnsavedData,
    hasSavedDraft,
  } = useFormPersistence<ClientEditFormData>({
    key: `client_edit_draft_${client.id}`,
    initialValue: initialFormData,
    userId: user?.id,
  });

  // Reset form data when client changes or dialog opens
  useEffect(() => {
    if (open && !hasSavedDraft()) {
      setFormData(initialFormData);
    }
  }, [open, client.id, initialFormData, setFormData, hasSavedDraft]);

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
        description: 'Você pode continuar a edição depois',
      });
    }
    setOpen(newOpen);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      toast.error('Nome do cliente é obrigatório');
      return;
    }

    setLoading(true);

    // Verificar se dados estavam incompletos antes
    const wasIncomplete = !client.phone || !client.revenue || !client.product_offered;

    try {
      const { error } = await supabase
        .from('clients')
        .update({
          name: formData.name.trim(),
          company: formData.company.trim() || null,
          email: formData.email.trim() || null,
          phone: formData.phone.trim() || null,
          niche: formData.niche.trim() || null,
          revenue: formData.revenue ? parseFloat(formData.revenue) : null,
          has_partner: formData.hasPartner,
          main_pain: formData.mainPain.trim() || null,
          main_difficulty: formData.mainDifficulty.trim() || null,
          notes: formData.notes.trim() || null,
          funnel_source: formData.funnelSource || null,
          sdr_name: formData.sdrName || null,
          product_offered: formData.productOffered || null,
          followup_date: formData.followupDate || null,
        })
        .eq('id', client.id);

      if (error) throw error;

      // Se dados estavam incompletos e agora estão completos, notificar líder
      const nowComplete = formData.phone.trim() && formData.revenue && formData.productOffered;
      if (wasIncomplete && nowComplete) {
        try {
          await supabase.functions.invoke('notify-client-completed', {
            body: { clientId: client.id }
          });
        } catch (notifyError) {
          console.error('Error notifying leader:', notifyError);
          // Não bloqueia o fluxo principal
        }
      }

      toast.success('Cliente atualizado com sucesso!');
      clearSavedData();
      setOpen(false);
      onClientUpdated();
    } catch (error) {
      console.error('Error updating client:', error);
      toast.error('Erro ao atualizar cliente');
    } finally {
      setLoading(false);
    }
  };

  const handleClearDraft = () => {
    setFormData(initialFormData);
    clearSavedData();
    toast.success('Rascunho removido');
  };

  const showDraftBadge = hasSavedDraft() && hasUnsavedData();

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Pencil className="w-4 h-4 mr-2" />
          Editar
          {showDraftBadge && (
            <Badge variant="secondary" className="ml-2 bg-amber-500/20 text-amber-600">
              <FileEdit className="w-3 h-3" />
            </Badge>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              Editar Cliente
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
          {/* Dados de Contato */}
          <div className="space-y-4">
            <h3 className="font-medium text-sm text-muted-foreground">Contato</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => updateField('name', e.target.value)}
                  placeholder="Nome completo"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Telefone</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => updateField('phone', e.target.value)}
                  placeholder="(00) 00000-0000"
                />
              </div>
              <div className="col-span-2 space-y-2">
                <Label htmlFor="email">E-mail</Label>
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

          {/* Dados do Negócio */}
          <div className="space-y-4">
            <h3 className="font-medium text-sm text-muted-foreground">Negócio</h3>
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
                  placeholder="Nicho de atuação"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="revenue">Faturamento Mensal</Label>
                <Input
                  id="revenue"
                  type="number"
                  value={formData.revenue}
                  onChange={(e) => updateField('revenue', e.target.value)}
                  placeholder="Faturamento mensal"
                />
              </div>
              <div className="flex items-center gap-2 pt-6">
                <Switch
                  id="hasPartner"
                  checked={formData.hasPartner}
                  onCheckedChange={(checked) => updateField('hasPartner', checked)}
                />
                <Label htmlFor="hasPartner">Tem Sócio</Label>
              </div>
              <div className="space-y-2">
                <Label htmlFor="funnelSource">Funil de Origem</Label>
                <Select value={formData.funnelSource || "none"} onValueChange={(val) => updateField('funnelSource', val === "none" ? "" : val)}>
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
                <Select value={formData.sdrName || "none"} onValueChange={(val) => updateField('sdrName', val === "none" ? "" : val)}>
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
                <Select value={formData.productOffered || "none"} onValueChange={(val) => updateField('productOffered', val === "none" ? "" : val)}>
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
                  value={formData.followupDate}
                  onChange={(e) => updateField('followupDate', e.target.value)}
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
                  value={formData.mainPain}
                  onChange={(e) => updateField('mainPain', e.target.value)}
                  placeholder="Principal dor do cliente"
                  rows={2}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="mainDifficulty">Dificuldade Principal</Label>
                <Textarea
                  id="mainDifficulty"
                  value={formData.mainDifficulty}
                  onChange={(e) => updateField('mainDifficulty', e.target.value)}
                  placeholder="Principal dificuldade"
                  rows={2}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes">Observações Gerais</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => updateField('notes', e.target.value)}
                  placeholder="Anotações adicionais"
                  rows={3}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
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
