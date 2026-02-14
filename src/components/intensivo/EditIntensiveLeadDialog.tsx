import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useIntensivoCRM } from '@/hooks/useIntensivoCRM';
import type { IntensiveLead, LeadTemperature } from '@/types/intensivo';

interface EditIntensiveLeadDialogProps {
  lead: IntensiveLead | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editionId: string;
}

export function EditIntensiveLeadDialog({ lead, open, onOpenChange, editionId }: EditIntensiveLeadDialogProps) {
  const { updateLead } = useIntensivoCRM(editionId);
  const [form, setForm] = useState({
    name: '',
    phone: '',
    email: '',
    company: '',
    niche: '',
    lead_temperature: 'morno' as LeadTemperature,
    source: '',
    notes: '',
  });

  useEffect(() => {
    if (lead) {
      setForm({
        name: lead.name || '',
        phone: lead.phone || '',
        email: lead.email || '',
        company: lead.company || '',
        niche: lead.niche || '',
        lead_temperature: lead.lead_temperature || 'morno',
        source: lead.source || '',
        notes: lead.notes || '',
      });
    }
  }, [lead]);

  const handleSave = async () => {
    if (!lead) return;
    await updateLead.mutateAsync({
      id: lead.id,
      name: form.name,
      phone: form.phone || null,
      email: form.email || null,
      company: form.company || null,
      niche: form.niche || null,
      lead_temperature: form.lead_temperature,
      source: form.source || null,
      notes: form.notes || null,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Editar Lead</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Nome *</Label>
            <Input value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} />
          </div>
          <div>
            <Label>Telefone</Label>
            <Input value={form.phone} onChange={(e) => setForm(f => ({ ...f, phone: e.target.value }))} />
          </div>
          <div>
            <Label>Email</Label>
            <Input type="email" value={form.email} onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))} />
          </div>
          <div>
            <Label>Empresa</Label>
            <Input value={form.company} onChange={(e) => setForm(f => ({ ...f, company: e.target.value }))} />
          </div>
          <div>
            <Label>Nicho</Label>
            <Input value={form.niche} onChange={(e) => setForm(f => ({ ...f, niche: e.target.value }))} />
          </div>
          <div>
            <Label>Temperatura</Label>
            <Select value={form.lead_temperature} onValueChange={(v) => setForm(f => ({ ...f, lead_temperature: v as LeadTemperature }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="quente">🔥 Quente</SelectItem>
                <SelectItem value="morno">🌡️ Morno</SelectItem>
                <SelectItem value="frio">❄️ Frio</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Origem</Label>
            <Input value={form.source} onChange={(e) => setForm(f => ({ ...f, source: e.target.value }))} />
          </div>
          <div>
            <Label>Observações</Label>
            <Textarea value={form.notes} onChange={(e) => setForm(f => ({ ...f, notes: e.target.value }))} rows={3} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={!form.name.trim() || updateLead.isPending}>
            {updateLead.isPending ? 'Salvando...' : 'Salvar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
