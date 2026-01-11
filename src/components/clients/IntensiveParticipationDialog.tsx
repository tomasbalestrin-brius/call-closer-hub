import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Trash2, Loader2, Zap, Calendar } from 'lucide-react';
import { useCreateClientActivity, useClientActivities, useDeleteClientActivity, useClientIndications } from '@/hooks/useClientActivities';
import { Client } from '@/types';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface IntensiveParticipationDialogProps {
  client: Client;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onActivityAdded?: () => void;
}

const INTENSIVE_OPTIONS = [
  'Intensivo Janeiro 2025',
  'Intensivo Fevereiro 2025',
  'Intensivo Março 2025',
  'Intensivo Abril 2025',
  'Intensivo Maio 2025',
  'Intensivo Junho 2025',
  'Intensivo Julho 2025',
  'Intensivo Agosto 2025',
  'Intensivo Setembro 2025',
  'Intensivo Outubro 2025',
  'Intensivo Novembro 2025',
  'Intensivo Dezembro 2025',
  'Intensivo Janeiro 2026',
  'Outro',
];

export default function IntensiveParticipationDialog({
  client,
  open,
  onOpenChange,
  onActivityAdded,
}: IntensiveParticipationDialogProps) {
  const [selectedIntensive, setSelectedIntensive] = useState('');
  const [customIntensive, setCustomIntensive] = useState('');
  const [activityDate, setActivityDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  
  const { data: activities, isLoading: activitiesLoading } = useClientActivities(client.id);
  const { data: indications } = useClientIndications(client.id);
  const createActivity = useCreateClientActivity();
  const deleteActivity = useDeleteClientActivity();
  
  const intensiveActivities = activities?.filter(a => a.activity_type === 'intensivo') || [];
  const intensivoIndications = indications?.filter(i => i.indication_type === 'intensivo') || [];
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const activityName = selectedIntensive === 'Outro' ? customIntensive : selectedIntensive;
    
    if (!activityName.trim()) return;
    
    await createActivity.mutateAsync({
      client_id: client.id,
      activity_type: 'intensivo',
      activity_name: activityName,
      activity_date: activityDate,
      notes: notes.trim() || null,
    });
    
    setSelectedIntensive('');
    setCustomIntensive('');
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
            <Zap className="w-5 h-5 text-warning" />
            Participação em Intensivo - {client.name}
          </DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Selecione o Intensivo</Label>
            <Select value={selectedIntensive} onValueChange={setSelectedIntensive}>
              <SelectTrigger>
                <SelectValue placeholder="Escolha uma edição..." />
              </SelectTrigger>
              <SelectContent>
                {INTENSIVE_OPTIONS.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          {selectedIntensive === 'Outro' && (
            <div className="space-y-2">
              <Label>Nome do Intensivo</Label>
              <Input
                value={customIntensive}
                onChange={(e) => setCustomIntensive(e.target.value)}
                placeholder="Digite o nome do intensivo..."
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
            disabled={createActivity.isPending || !selectedIntensive || (selectedIntensive === 'Outro' && !customIntensive)}
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
        
        {/* Indicações para Intensivo */}
        {intensivoIndications.length > 0 && (
          <div className="mt-6 pt-4 border-t">
            <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
              <span className="text-muted-foreground">Indicações para Intensivo:</span>
              <span className="bg-primary/10 text-primary px-2 py-0.5 rounded-full text-xs font-semibold">
                {intensivoIndications.length}
              </span>
            </h4>
            <ul className="space-y-2 text-sm">
              {intensivoIndications.map((indication) => (
                <li key={indication.id} className="flex items-center justify-between bg-muted/50 rounded-md px-3 py-2">
                  <div>
                    <span className="font-medium">{indication.indicated_name}</span>
                    <span className="text-muted-foreground ml-2">({indication.indicated_phone})</span>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    indication.status === 'convertido' ? 'bg-success/20 text-success' :
                    indication.status === 'contatado' ? 'bg-info/20 text-info' :
                    indication.status === 'perdido' ? 'bg-destructive/20 text-destructive' :
                    'bg-warning/20 text-warning'
                  }`}>
                    {indication.status}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
        
        {/* Histórico de Participações */}
        {!activitiesLoading && intensiveActivities.length > 0 && (
          <div className="mt-6 pt-4 border-t">
            <h4 className="text-sm font-medium mb-3">Histórico de Participações</h4>
            <div className="space-y-2">
              {intensiveActivities.map((activity) => (
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
