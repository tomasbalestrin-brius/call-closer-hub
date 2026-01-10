import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TICKET_LABELS } from '@/types';
import { useCreateUpgrade } from '@/hooks/usePortfolio';
import type { PortfolioStudent, TicketType } from '@/types';

interface UpgradeTicketDialogProps {
  student: PortfolioStudent | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const ticketStyles: Record<TicketType, string> = {
  '29_90': 'bg-amber-500/10 text-amber-600 border-amber-500/30',
  '12k': 'bg-sky-500/10 text-sky-600 border-sky-500/30',
  '80k': 'bg-yellow-500/10 text-yellow-600 border-yellow-500/30',
};

const getNextTickets = (current: TicketType): TicketType[] => {
  if (current === '29_90') return ['12k', '80k'];
  if (current === '12k') return ['80k'];
  return [];
};

export default function UpgradeTicketDialog({ student, open, onOpenChange }: UpgradeTicketDialogProps) {
  const createUpgrade = useCreateUpgrade();
  const [formData, setFormData] = useState({
    to_ticket: '' as TicketType | '',
    upgrade_date: new Date().toISOString().split('T')[0],
    sale_value: '',
    entry_value: '',
    notes: '',
  });
  
  if (!student) return null;
  
  const availableTickets = getNextTickets(student.current_ticket);
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.to_ticket) return;
    
    await createUpgrade.mutateAsync({
      student_id: student.id,
      studentId: student.id,
      from_ticket: student.current_ticket,
      to_ticket: formData.to_ticket,
      newTicket: formData.to_ticket,
      upgrade_date: formData.upgrade_date,
      sale_value: formData.sale_value ? parseFloat(formData.sale_value) : null,
      entry_value: formData.entry_value ? parseFloat(formData.entry_value) : null,
      notes: formData.notes || null,
    });
    
    setFormData({
      to_ticket: '',
      upgrade_date: new Date().toISOString().split('T')[0],
      sale_value: '',
      entry_value: '',
      notes: '',
    });
    onOpenChange(false);
  };
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle>Registrar Ascensão</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Current → New Ticket */}
          <div className="flex items-center justify-center gap-4 py-4">
            <Badge 
              variant="outline" 
              className={cn('text-lg px-4 py-2', ticketStyles[student.current_ticket])}
            >
              {TICKET_LABELS[student.current_ticket]}
            </Badge>
            <ArrowRight className="w-6 h-6 text-muted-foreground" />
            <Select
              value={formData.to_ticket}
              onValueChange={(value: TicketType) => setFormData({ ...formData, to_ticket: value })}
            >
              <SelectTrigger className="w-[120px]">
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {availableTickets.map((ticket) => (
                  <SelectItem key={ticket} value={ticket}>
                    {TICKET_LABELS[ticket]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Label htmlFor="upgrade_date">Data da Ascensão *</Label>
              <Input
                id="upgrade_date"
                type="date"
                value={formData.upgrade_date}
                onChange={(e) => setFormData({ ...formData, upgrade_date: e.target.value })}
                required
              />
            </div>
            
            <div>
              <Label htmlFor="sale_value">Valor Total</Label>
              <Input
                id="sale_value"
                type="number"
                step="0.01"
                value={formData.sale_value}
                onChange={(e) => setFormData({ ...formData, sale_value: e.target.value })}
                placeholder="R$ 0,00"
              />
            </div>
            
            <div>
              <Label htmlFor="entry_value">Valor de Entrada</Label>
              <Input
                id="entry_value"
                type="number"
                step="0.01"
                value={formData.entry_value}
                onChange={(e) => setFormData({ ...formData, entry_value: e.target.value })}
                placeholder="R$ 0,00"
              />
            </div>
            
            <div className="col-span-2">
              <Label htmlFor="notes">Observações</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Observações sobre a ascensão..."
                rows={3}
              />
            </div>
          </div>
          
          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={!formData.to_ticket || createUpgrade.isPending}>
              {createUpgrade.isPending ? 'Salvando...' : 'Registrar Ascensão'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
