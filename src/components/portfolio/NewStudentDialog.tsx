import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCreateStudent } from '@/hooks/usePortfolio';
import type { TicketType } from '@/types';

interface NewStudentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function NewStudentDialog({ open, onOpenChange }: NewStudentDialogProps) {
  const createStudent = useCreateStudent();
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    current_ticket: '29_90' as TicketType,
    entry_date: new Date().toISOString().split('T')[0],
    niche: '',
    notes: '',
  });
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    await createStudent.mutateAsync({
      name: formData.name,
      phone: formData.phone || null,
      email: formData.email || null,
      current_ticket: formData.current_ticket,
      entry_date: formData.entry_date,
      niche: formData.niche || null,
      notes: formData.notes || null,
      client_id: null,
    });
    
    setFormData({
      name: '',
      phone: '',
      email: '',
      current_ticket: '29_90',
      entry_date: new Date().toISOString().split('T')[0],
      niche: '',
      notes: '',
    });
    onOpenChange(false);
  };
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Novo Aluno</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Label htmlFor="name">Nome *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Nome do aluno"
                required
              />
            </div>
            
            <div>
              <Label htmlFor="phone">Telefone</Label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="(00) 00000-0000"
              />
            </div>
            
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="email@exemplo.com"
              />
            </div>
            
            <div>
              <Label htmlFor="ticket">Ticket *</Label>
              <Select
                value={formData.current_ticket}
                onValueChange={(value: TicketType) => setFormData({ ...formData, current_ticket: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="29_90">29,90</SelectItem>
                  <SelectItem value="12k">12K</SelectItem>
                  <SelectItem value="80k">80K</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label htmlFor="entry_date">Data de Entrada *</Label>
              <Input
                id="entry_date"
                type="date"
                value={formData.entry_date}
                onChange={(e) => setFormData({ ...formData, entry_date: e.target.value })}
                required
              />
            </div>
            
            <div className="col-span-2">
              <Label htmlFor="niche">Nicho</Label>
              <Input
                id="niche"
                value={formData.niche}
                onChange={(e) => setFormData({ ...formData, niche: e.target.value })}
                placeholder="Nicho do aluno"
              />
            </div>
            
            <div className="col-span-2">
              <Label htmlFor="notes">Observações</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Observações sobre o aluno..."
                rows={3}
              />
            </div>
          </div>
          
          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={createStudent.isPending}>
              {createStudent.isPending ? 'Salvando...' : 'Adicionar Aluno'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
