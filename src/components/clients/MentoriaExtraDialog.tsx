import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Trash2, Loader2, BookOpen, Calendar } from 'lucide-react';
import { useCreateClientActivity, useClientActivities, useDeleteClientActivity } from '@/hooks/useClientActivities';
import { Client } from '@/types';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface MentoriaExtraDialogProps {
  client: Client;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onActivityAdded?: () => void;
}

const MENTORIA_OPTIONS = [
  'Mentoria Comercial',
  'Mentoria de Marketing',
  'Mentoria de Mindset',
  'Mentoria de Vendas',
  'Mentoria de Liderança',
  'Mentoria Especial',
  'Mentoria de Grupo',
  'Mentoria Individual',
  'Outro',
];

export default function MentoriaExtraDialog({
  client,
  open,
  onOpenChange,
  onActivityAdded,
}: MentoriaExtraDialogProps) {
  const [selectedMentoria, setSelectedMentoria] = useState('');
  const [customMentoria, setCustomMentoria] = useState('');
  const [activityDate, setActivityDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  
  const { data: activities, isLoading: activitiesLoading } = useClientActivities(client.id);
  const createActivity = useCreateClientActivity();
  const deleteActivity = useDeleteClientActivity();
  
  const mentoriaActivities = activities?.filter(a => a.activity_type === 'mentoria') || [];
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const activityName = selectedMentoria === 'Outro' ? customMentoria : selectedMentoria;
    
    if (!activityName.trim()) return;
    
    await createActivity.mutateAsync({
      client_id: client.id,
      activity_type: 'mentoria',
      activity_name: activityName,
      activity_date: activityDate,
      notes: notes.trim() || null,
    });
    
    setSelectedMentoria('');
    setCustomMentoria('');
    setNotes('');
    onActivityAdded?.();
  };
  
  const handleDelete = async (activityId: string) => {
    await deleteActivity.mutateAsync({ id: activityId, clientId: client.id });
  };
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-primary" />
            Mentoria Extra - {client.name}
          </DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Selecione a Mentoria</Label>
            <Select value={selectedMentoria} onValueChange={setSelectedMentoria}>
              <SelectTrigger>
                <SelectValue placeholder="Escolha uma mentoria..." />
              </SelectTrigger>
              <SelectContent>
                {MENTORIA_OPTIONS.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          {selectedMentoria === 'Outro' && (
            <div className="space-y-2">
              <Label>Nome da Mentoria</Label>
              <Input
                value={customMentoria}
                onChange={(e) => setCustomMentoria(e.target.value)}
                placeholder="Digite o nome da mentoria..."
              />
            </div>
          )}
          
          <div className="space-y-2">
            <Label>Data de Participação</Label>
            <Input
              type="date"
              value={activityDate}
              onChange={(e) => setActivityDate(e.target.value)}
            />
          </div>
          
          <div className="space-y-2">
            <Label>Observações (opcional)</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Alguma observação sobre a participação..."
              rows={2}
            />
          </div>
          
          <Button 
            type="submit" 
            className="w-full" 
            disabled={createActivity.isPending || !selectedMentoria || (selectedMentoria === 'Outro' && !customMentoria)}
          >
            {createActivity.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Registrando...
              </>
            ) : (
              'Registrar Participação'
            )}
          </Button>
        </form>
        
        {/* Histórico de Mentorias */}
        {!activitiesLoading && mentoriaActivities.length > 0 && (
          <div className="mt-6 pt-4 border-t">
            <h4 className="text-sm font-medium mb-3">Histórico de Mentorias</h4>
            <div className="space-y-2">
              {mentoriaActivities.map((activity) => (
                <div 
                  key={activity.id} 
                  className="flex items-center justify-between bg-muted/50 rounded-md px-3 py-2"
                >
                  <div className="flex items-center gap-3">
                    <Calendar className="w-4 h-4 text-muted-foreground" />
                    <div>
                      <p className="font-medium text-sm">{activity.activity_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(activity.activity_date), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    onClick={() => handleDelete(activity.id)}
                    disabled={deleteActivity.isPending}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}
        
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
