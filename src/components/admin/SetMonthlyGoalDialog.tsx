import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useAuditLog } from '@/hooks/useAuditLog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, Target } from 'lucide-react';
import { toast } from 'sonner';

interface Closer {
  id: string;
  user_id: string;
  full_name: string;
}

interface SetMonthlyGoalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  closers: Closer[];
}

const MONTHS = [
  { value: 1, label: 'Janeiro' },
  { value: 2, label: 'Fevereiro' },
  { value: 3, label: 'Março' },
  { value: 4, label: 'Abril' },
  { value: 5, label: 'Maio' },
  { value: 6, label: 'Junho' },
  { value: 7, label: 'Julho' },
  { value: 8, label: 'Agosto' },
  { value: 9, label: 'Setembro' },
  { value: 10, label: 'Outubro' },
  { value: 11, label: 'Novembro' },
  { value: 12, label: 'Dezembro' },
];

export function SetMonthlyGoalDialog({ 
  open, 
  onOpenChange, 
  onSuccess, 
  closers 
}: SetMonthlyGoalDialogProps) {
  const { user } = useAuth();
  const { logAction } = useAuditLog();
  const [loading, setLoading] = useState(false);
  const [selectedCloserId, setSelectedCloserId] = useState<string>('');
  const [goalValue, setGoalValue] = useState<string>('');
  const [month, setMonth] = useState<number>(new Date().getMonth() + 1);
  const [year, setYear] = useState<number>(new Date().getFullYear());
  useEffect(() => {
    if (open) {
      // Reset form when dialog opens
      setSelectedCloserId('');
      setGoalValue('');
      setMonth(new Date().getMonth() + 1);
      setYear(new Date().getFullYear());
    }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedCloserId) {
      toast.error('Selecione um closer');
      return;
    }

    const value = parseFloat(goalValue.replace(/[^\d.,]/g, '').replace(',', '.'));
    if (isNaN(value) || value <= 0) {
      toast.error('Informe um valor válido para a meta');
      return;
    }

    if (!user) return;

    setLoading(true);

    const selectedCloser = closers.find(c => c.user_id === selectedCloserId);

    try {
      // Check if goal already exists
      const { data: existingGoal } = await supabase
        .from('monthly_goals')
        .select('id, goal_value')
        .eq('closer_id', selectedCloserId)
        .eq('month', month)
        .eq('year', year)
        .maybeSingle();

      if (existingGoal) {
        const oldValue = existingGoal.goal_value;
        
        // Update existing goal
        const { error } = await supabase
          .from('monthly_goals')
          .update({ 
            goal_value: value,
            set_by_user_id: user.id,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingGoal.id);

        if (error) throw error;

        // Log audit
        await logAction({
          actionType: 'goal_updated',
          entityType: 'monthly_goal',
          targetUserId: selectedCloserId,
          entityId: existingGoal.id,
          oldValue: { goal_value: oldValue },
          newValue: { goal_value: value },
          metadata: { 
            closer_name: selectedCloser?.full_name,
            month,
            year 
          },
        });

        toast.success('Meta atualizada com sucesso!');
      } else {
        // Create new goal
        const { data: newGoal, error } = await supabase
          .from('monthly_goals')
          .insert({
            closer_id: selectedCloserId,
            month,
            year,
            goal_value: value,
            set_by_user_id: user.id,
          })
          .select('id')
          .single();

        if (error) throw error;

        // Log audit
        await logAction({
          actionType: 'goal_created',
          entityType: 'monthly_goal',
          targetUserId: selectedCloserId,
          entityId: newGoal?.id,
          newValue: { goal_value: value },
          metadata: { 
            closer_name: selectedCloser?.full_name,
            month,
            year 
          },
        });

        toast.success('Meta definida com sucesso!');
      }

      onSuccess();
    } catch (error) {
      console.error('Error setting goal:', error);
      toast.error('Erro ao definir meta');
    } finally {
      setLoading(false);
    }
  };

  const currentYear = new Date().getFullYear();
  const years = [currentYear - 1, currentYear, currentYear + 1];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2">
            <Target className="w-5 h-5" />
            Definir Meta Mensal
          </DialogTitle>
          <DialogDescription>
            Defina a meta de vendas para um closer em um determinado mês.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>Closer *</Label>
              <Select value={selectedCloserId} onValueChange={setSelectedCloserId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o closer" />
                </SelectTrigger>
                <SelectContent>
                  {closers.map((closer) => (
                    <SelectItem key={closer.user_id} value={closer.user_id}>
                      {closer.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Mês *</Label>
                <Select 
                  value={month.toString()} 
                  onValueChange={(v) => setMonth(parseInt(v))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MONTHS.map((m) => (
                      <SelectItem key={m.value} value={m.value.toString()}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Ano *</Label>
                <Select 
                  value={year.toString()} 
                  onValueChange={(v) => setYear(parseInt(v))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {years.map((y) => (
                      <SelectItem key={y} value={y.toString()}>
                        {y}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Valor da Meta (R$) *</Label>
              <Input
                type="text"
                placeholder="Ex: 100000"
                value={goalValue}
                onChange={(e) => setGoalValue(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" className="gradient-primary" disabled={loading}>
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {loading ? 'Salvando...' : 'Salvar Meta'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
