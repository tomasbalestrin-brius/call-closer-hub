import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCreateStudentIndication } from '@/hooks/usePortfolio';
import type { PortfolioStudent } from '@/types';

interface StudentIndicationDialogProps {
  student: PortfolioStudent | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function StudentIndicationDialog({ student, open, onOpenChange }: StudentIndicationDialogProps) {
  const createIndication = useCreateStudentIndication();
  const [formData, setFormData] = useState({
    indicated_name: '',
    indicated_phone: '',
    indicated_email: '',
    indication_type: '' as 'call' | 'intensivo' | '',
    notes: '',
  });
  
  if (!student) return null;
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.indication_type) return;
    
    await createIndication.mutateAsync({
      student_id: student.id,
      indicated_name: formData.indicated_name,
      indicated_phone: formData.indicated_phone,
      indicated_email: formData.indicated_email || undefined,
      indication_type: formData.indication_type,
      notes: formData.notes || undefined,
    });
    
    setFormData({
      indicated_name: '',
      indicated_phone: '',
      indicated_email: '',
      indication_type: '',
      notes: '',
    });
    onOpenChange(false);
  };
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle>Nova Indicação</DialogTitle>
        </DialogHeader>
        
        <p className="text-sm text-muted-foreground">
          Registrar indicação feita por <strong>{student.name}</strong>
        </p>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="indicated_name">Nome do Indicado *</Label>
            <Input
              id="indicated_name"
              value={formData.indicated_name}
              onChange={(e) => setFormData({ ...formData, indicated_name: e.target.value })}
              placeholder="Nome completo"
              required
            />
          </div>
          
          <div>
            <Label htmlFor="indicated_phone">Telefone *</Label>
            <Input
              id="indicated_phone"
              value={formData.indicated_phone}
              onChange={(e) => setFormData({ ...formData, indicated_phone: e.target.value })}
              placeholder="(00) 00000-0000"
              required
            />
          </div>
          
          <div>
            <Label htmlFor="indicated_email">Email</Label>
            <Input
              id="indicated_email"
              type="email"
              value={formData.indicated_email}
              onChange={(e) => setFormData({ ...formData, indicated_email: e.target.value })}
              placeholder="email@exemplo.com"
            />
          </div>
          
          <div>
            <Label htmlFor="indication_type">Tipo de Indicação *</Label>
            <Select
              value={formData.indication_type}
              onValueChange={(value: 'call' | 'intensivo') => setFormData({ ...formData, indication_type: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione o tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="call">Para Call</SelectItem>
                <SelectItem value="intensivo">Para Intensivo</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div>
            <Label htmlFor="notes">Observações</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Observações sobre a indicação..."
              rows={3}
            />
          </div>
          
          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button 
              type="submit" 
              disabled={!formData.indicated_name || !formData.indicated_phone || !formData.indication_type || createIndication.isPending}
            >
              {createIndication.isPending ? 'Salvando...' : 'Registrar Indicação'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
