import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ACTIVITY_TYPE_LABELS } from '@/types';
import { useCreateActivity } from '@/hooks/usePortfolio';
import type { PortfolioStudent, StudentActivityType } from '@/types';

interface ActivityDialogProps {
  student: PortfolioStudent | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function ActivityDialog({ student, open, onOpenChange }: ActivityDialogProps) {
  const createActivity = useCreateActivity();
  const [formData, setFormData] = useState({
    activity_type: '' as StudentActivityType | '',
    activity_name: '',
    activity_date: new Date().toISOString().split('T')[0],
    notes: '',
  });
  
  if (!student) return null;
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.activity_type) return;
    
    await createActivity.mutateAsync({
      student_id: student.id,
      activity_type: formData.activity_type,
      activity_name: formData.activity_name,
      activity_date: formData.activity_date,
      notes: formData.notes || null,
    });
    
    setFormData({
      activity_type: '',
      activity_name: '',
      activity_date: new Date().toISOString().split('T')[0],
      notes: '',
    });
    onOpenChange(false);
  };
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle>Registrar Atividade</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="activity_type">Tipo de Atividade *</Label>
            <Select
              value={formData.activity_type}
              onValueChange={(value: StudentActivityType) => setFormData({ ...formData, activity_type: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione o tipo" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(ACTIVITY_TYPE_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div>
            <Label htmlFor="activity_name">Nome da Atividade *</Label>
            <Input
              id="activity_name"
              value={formData.activity_name}
              onChange={(e) => setFormData({ ...formData, activity_name: e.target.value })}
              placeholder="Ex: Intensivo de Janeiro"
              required
            />
          </div>
          
          <div>
            <Label htmlFor="activity_date">Data da Atividade *</Label>
            <Input
              id="activity_date"
              type="date"
              value={formData.activity_date}
              onChange={(e) => setFormData({ ...formData, activity_date: e.target.value })}
              required
            />
          </div>
          
          <div>
            <Label htmlFor="notes">Observações</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Observações sobre a atividade..."
              rows={3}
            />
          </div>
          
          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={!formData.activity_type || !formData.activity_name || createActivity.isPending}>
              {createActivity.isPending ? 'Salvando...' : 'Registrar Atividade'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
