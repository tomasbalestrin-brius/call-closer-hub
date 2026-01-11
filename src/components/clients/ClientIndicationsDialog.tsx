import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Loader2, Users, Plus, Minus, Phone } from 'lucide-react';
import { useCreateClientIndication, useClientIndications } from '@/hooks/useClientActivities';
import { Client, IndicationType } from '@/types';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ClientIndicationsDialogProps {
  client: Client;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onIndicationAdded?: () => void;
}

interface IndicationInput {
  id: string;
  name: string;
  phone: string;
  email: string;
}

export default function ClientIndicationsDialog({
  client,
  open,
  onOpenChange,
  onIndicationAdded,
}: ClientIndicationsDialogProps) {
  const [indicationType, setIndicationType] = useState<IndicationType>('call');
  const [indications, setIndications] = useState<IndicationInput[]>([
    { id: '1', name: '', phone: '', email: '' }
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const { data: existingIndications, isLoading } = useClientIndications(client.id);
  const createIndication = useCreateClientIndication();
  
  const addIndicationRow = () => {
    setIndications(prev => [
      ...prev,
      { id: Date.now().toString(), name: '', phone: '', email: '' }
    ]);
  };
  
  const removeIndicationRow = (id: string) => {
    if (indications.length <= 1) return;
    setIndications(prev => prev.filter(i => i.id !== id));
  };
  
  const updateIndication = (id: string, field: keyof IndicationInput, value: string) => {
    setIndications(prev => 
      prev.map(i => i.id === id ? { ...i, [field]: value } : i)
    );
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const validIndications = indications.filter(i => i.name.trim() && i.phone.trim());
    
    if (validIndications.length === 0) return;
    
    setIsSubmitting(true);
    
    try {
      for (const indication of validIndications) {
        await createIndication.mutateAsync({
          client_id: client.id,
          indicated_name: indication.name.trim(),
          indicated_phone: indication.phone.trim(),
          indicated_email: indication.email.trim() || undefined,
          indication_type: indicationType,
        });
      }
      
      setIndications([{ id: '1', name: '', phone: '', email: '' }]);
      onIndicationAdded?.();
    } catch (error) {
      console.error('Error creating indications:', error);
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const callIndications = existingIndications?.filter(i => i.indication_type === 'call') || [];
  const intensivoIndications = existingIndications?.filter(i => i.indication_type === 'intensivo') || [];
  
  const canSubmit = indications.some(i => i.name.trim() && i.phone.trim());
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            Registrar Indicações - {client.name}
          </DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Tipo de Indicação */}
          <div className="space-y-3">
            <Label>Tipo de Indicação</Label>
            <RadioGroup 
              value={indicationType} 
              onValueChange={(v) => setIndicationType(v as IndicationType)}
              className="flex gap-6"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="call" id="call" />
                <Label htmlFor="call" className="cursor-pointer">Indicação Call</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="intensivo" id="intensivo" />
                <Label htmlFor="intensivo" className="cursor-pointer">Indicação Intensivo</Label>
              </div>
            </RadioGroup>
          </div>
          
          {/* Lista de Indicações */}
          <div className="space-y-3">
            <Label>Indicações</Label>
            {indications.map((indication, index) => (
              <div key={indication.id} className="flex gap-2 items-start">
                <div className="flex-1 grid grid-cols-3 gap-2">
                  <Input
                    placeholder="Nome *"
                    value={indication.name}
                    onChange={(e) => updateIndication(indication.id, 'name', e.target.value)}
                  />
                  <Input
                    placeholder="Telefone *"
                    value={indication.phone}
                    onChange={(e) => updateIndication(indication.id, 'phone', e.target.value)}
                  />
                  <Input
                    placeholder="Email (opcional)"
                    type="email"
                    value={indication.email}
                    onChange={(e) => updateIndication(indication.id, 'email', e.target.value)}
                  />
                </div>
                <div className="flex gap-1">
                  {index === indications.length - 1 && (
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={addIndicationRow}
                    >
                      <Plus className="w-4 h-4" />
                    </Button>
                  )}
                  {indications.length > 1 && (
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => removeIndicationRow(indication.id)}
                    >
                      <Minus className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
          
          <Button 
            type="submit" 
            className="w-full" 
            disabled={isSubmitting || !canSubmit}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Salvando...
              </>
            ) : (
              'Salvar Indicações'
            )}
          </Button>
        </form>
        
        {/* Histórico de Indicações */}
        {!isLoading && existingIndications && existingIndications.length > 0 && (
          <div className="mt-6 pt-4 border-t space-y-4">
            <h4 className="text-sm font-medium">Indicações Feitas por este Cliente</h4>
            
            {callIndications.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground mb-2">Indicações para Call ({callIndications.length})</p>
                <div className="space-y-2">
                  {callIndications.map((indication) => (
                    <div 
                      key={indication.id} 
                      className="flex items-center justify-between bg-muted/50 rounded-md px-3 py-2"
                    >
                      <div className="flex items-center gap-3">
                        <Phone className="w-4 h-4 text-muted-foreground" />
                        <div>
                          <p className="font-medium text-sm">{indication.indicated_name}</p>
                          <p className="text-xs text-muted-foreground">{indication.indicated_phone}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          indication.status === 'convertido' ? 'bg-success/20 text-success' :
                          indication.status === 'contatado' ? 'bg-info/20 text-info' :
                          indication.status === 'perdido' ? 'bg-destructive/20 text-destructive' :
                          'bg-warning/20 text-warning'
                        }`}>
                          {indication.status}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(indication.created_at), "dd/MM/yy", { locale: ptBR })}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {intensivoIndications.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground mb-2">Indicações para Intensivo ({intensivoIndications.length})</p>
                <div className="space-y-2">
                  {intensivoIndications.map((indication) => (
                    <div 
                      key={indication.id} 
                      className="flex items-center justify-between bg-muted/50 rounded-md px-3 py-2"
                    >
                      <div className="flex items-center gap-3">
                        <Users className="w-4 h-4 text-muted-foreground" />
                        <div>
                          <p className="font-medium text-sm">{indication.indicated_name}</p>
                          <p className="text-xs text-muted-foreground">{indication.indicated_phone}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          indication.status === 'convertido' ? 'bg-success/20 text-success' :
                          indication.status === 'contatado' ? 'bg-info/20 text-info' :
                          indication.status === 'perdido' ? 'bg-destructive/20 text-destructive' :
                          'bg-warning/20 text-warning'
                        }`}>
                          {indication.status}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(indication.created_at), "dd/MM/yy", { locale: ptBR })}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
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
