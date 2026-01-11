import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Loader2, Link2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { usePendingIndications, useUpdateIndicationStatus } from '@/hooks/useClientActivities';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Client } from '@/types';

interface IndicationSourceDialogProps {
  client: Client;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLinked?: () => void;
}

export default function IndicationSourceDialog({
  client,
  open,
  onOpenChange,
  onLinked,
}: IndicationSourceDialogProps) {
  const [selectedIndicationId, setSelectedIndicationId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [matchedIndications, setMatchedIndications] = useState<any[]>([]);
  
  const { data: pendingIndications, isLoading } = usePendingIndications();
  const updateIndicationStatus = useUpdateIndicationStatus();
  
  // Buscar indicações que correspondem ao cliente (por nome ou telefone)
  useEffect(() => {
    if (pendingIndications && client) {
      const clientNameLower = client.name.toLowerCase().trim();
      const clientPhone = client.phone?.replace(/\D/g, '') || '';
      
      const matched = pendingIndications.filter(indication => {
        const indicationNameLower = indication.indicated_name.toLowerCase().trim();
        const indicationPhone = indication.indicated_phone.replace(/\D/g, '');
        
        // Match por nome (contém) ou telefone (exato, últimos 8 dígitos)
        const nameMatch = indicationNameLower.includes(clientNameLower) || 
                         clientNameLower.includes(indicationNameLower);
        const phoneMatch = clientPhone && indicationPhone && 
                          (clientPhone.slice(-8) === indicationPhone.slice(-8));
        
        return nameMatch || phoneMatch;
      });
      
      setMatchedIndications(matched);
      
      // Auto-seleciona se houver apenas uma correspondência
      if (matched.length === 1) {
        setSelectedIndicationId(matched[0].id);
      }
    }
  }, [pendingIndications, client]);
  
  const handleLink = async () => {
    if (!selectedIndicationId) return;
    
    setIsSubmitting(true);
    
    try {
      // Atualizar o cliente com a referência da indicação
      const { error: clientError } = await supabase
        .from('clients')
        .update({
          is_from_indication: true,
          indication_source_id: selectedIndicationId,
        })
        .eq('id', client.id);
      
      if (clientError) throw clientError;
      
      // Atualizar o status da indicação para 'convertido'
      await updateIndicationStatus.mutateAsync({
        id: selectedIndicationId,
        status: 'convertido',
      });
      
      toast.success('Cliente vinculado à indicação com sucesso!');
      onLinked?.();
      onOpenChange(false);
    } catch (error) {
      console.error('Error linking indication:', error);
      toast.error('Erro ao vincular indicação');
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const handleRemoveLink = async () => {
    setIsSubmitting(true);
    
    try {
      // Remover vínculo do cliente
      const { error } = await supabase
        .from('clients')
        .update({
          is_from_indication: false,
          indication_source_id: null,
        })
        .eq('id', client.id);
      
      if (error) throw error;
      
      // Se havia uma indicação vinculada, voltar status para pendente
      if (client.indication_source_id) {
        await updateIndicationStatus.mutateAsync({
          id: client.indication_source_id,
          status: 'pendente',
        });
      }
      
      toast.success('Vínculo de indicação removido!');
      onLinked?.();
      onOpenChange(false);
    } catch (error) {
      console.error('Error removing link:', error);
      toast.error('Erro ao remover vínculo');
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const hasMatchingIndications = matchedIndications.length > 0;
  const hasOtherIndications = pendingIndications && pendingIndications.length > matchedIndications.length;
  const otherIndications = pendingIndications?.filter(i => !matchedIndications.some(m => m.id === i.id)) || [];
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="w-5 h-5 text-primary" />
            Origem de Indicação - {client.name}
          </DialogTitle>
          <DialogDescription>
            Vincule este cliente a uma indicação previamente cadastrada
          </DialogDescription>
        </DialogHeader>
        
        {/* Se já está vinculado */}
        {client.is_from_indication && client.indication_source_id && (
          <div className="bg-success/10 border border-success/30 rounded-md p-4">
            <div className="flex items-center gap-2 text-success">
              <CheckCircle2 className="w-5 h-5" />
              <span className="font-medium">Cliente já está vinculado a uma indicação</span>
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              Este cliente foi convertido a partir de uma indicação.
            </p>
            <Button 
              variant="outline" 
              size="sm" 
              className="mt-3"
              onClick={handleRemoveLink}
              disabled={isSubmitting}
            >
              {isSubmitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Remover Vínculo
            </Button>
          </div>
        )}
        
        {/* Se não está vinculado */}
        {!client.is_from_indication && (
          <>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : hasMatchingIndications ? (
              <div className="space-y-4">
                <div className="bg-primary/10 border border-primary/30 rounded-md p-3">
                  <p className="text-sm font-medium">
                    Encontramos {matchedIndications.length} indicação(ões) que corresponde(m) a este cliente:
                  </p>
                </div>
                
                <RadioGroup 
                  value={selectedIndicationId || ''} 
                  onValueChange={setSelectedIndicationId}
                  className="space-y-2"
                >
                  {matchedIndications.map((indication) => (
                    <div 
                      key={indication.id} 
                      className={`flex items-center space-x-3 p-3 rounded-md border cursor-pointer transition-colors ${
                        selectedIndicationId === indication.id 
                          ? 'border-primary bg-primary/5' 
                          : 'border-border hover:bg-muted/50'
                      }`}
                      onClick={() => setSelectedIndicationId(indication.id)}
                    >
                      <RadioGroupItem value={indication.id} id={indication.id} />
                      <div className="flex-1">
                        <p className="font-medium">{indication.indicated_name}</p>
                        <p className="text-sm text-muted-foreground">{indication.indicated_phone}</p>
                        <p className="text-xs text-muted-foreground">
                          Tipo: {indication.indication_type === 'call' ? 'Call' : 'Intensivo'}
                        </p>
                      </div>
                    </div>
                  ))}
                </RadioGroup>
                
                {hasOtherIndications && (
                  <div className="pt-4 border-t">
                    <p className="text-xs text-muted-foreground mb-2">
                      Outras indicações pendentes:
                    </p>
                    <RadioGroup 
                      value={selectedIndicationId || ''} 
                      onValueChange={setSelectedIndicationId}
                      className="space-y-2"
                    >
                      {otherIndications.map((indication) => (
                        <div 
                          key={indication.id} 
                          className={`flex items-center space-x-3 p-3 rounded-md border cursor-pointer transition-colors ${
                            selectedIndicationId === indication.id 
                              ? 'border-primary bg-primary/5' 
                              : 'border-border hover:bg-muted/50'
                          }`}
                          onClick={() => setSelectedIndicationId(indication.id)}
                        >
                          <RadioGroupItem value={indication.id} id={indication.id} />
                          <div className="flex-1">
                            <p className="font-medium">{indication.indicated_name}</p>
                            <p className="text-sm text-muted-foreground">{indication.indicated_phone}</p>
                          </div>
                        </div>
                      ))}
                    </RadioGroup>
                  </div>
                )}
                
                <Button 
                  onClick={handleLink} 
                  className="w-full"
                  disabled={!selectedIndicationId || isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Vinculando...
                    </>
                  ) : (
                    'Vincular Indicação'
                  )}
                </Button>
              </div>
            ) : pendingIndications && pendingIndications.length > 0 ? (
              <div className="space-y-4">
                <div className="bg-warning/10 border border-warning/30 rounded-md p-3 flex items-start gap-2">
                  <AlertCircle className="w-5 h-5 text-warning mt-0.5" />
                  <div>
                    <p className="text-sm font-medium">Nenhuma correspondência automática</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Não encontramos indicações que correspondam ao nome ou telefone deste cliente.
                      Você pode selecionar manualmente abaixo:
                    </p>
                  </div>
                </div>
                
                <RadioGroup 
                  value={selectedIndicationId || ''} 
                  onValueChange={setSelectedIndicationId}
                  className="space-y-2"
                >
                  {pendingIndications.map((indication) => (
                    <div 
                      key={indication.id} 
                      className={`flex items-center space-x-3 p-3 rounded-md border cursor-pointer transition-colors ${
                        selectedIndicationId === indication.id 
                          ? 'border-primary bg-primary/5' 
                          : 'border-border hover:bg-muted/50'
                      }`}
                      onClick={() => setSelectedIndicationId(indication.id)}
                    >
                      <RadioGroupItem value={indication.id} id={indication.id} />
                      <div className="flex-1">
                        <p className="font-medium">{indication.indicated_name}</p>
                        <p className="text-sm text-muted-foreground">{indication.indicated_phone}</p>
                        <p className="text-xs text-muted-foreground">
                          Tipo: {indication.indication_type === 'call' ? 'Call' : 'Intensivo'}
                        </p>
                      </div>
                    </div>
                  ))}
                </RadioGroup>
                
                <Button 
                  onClick={handleLink} 
                  className="w-full"
                  disabled={!selectedIndicationId || isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Vinculando...
                    </>
                  ) : (
                    'Vincular Indicação'
                  )}
                </Button>
              </div>
            ) : (
              <div className="bg-muted/50 rounded-md p-6 text-center">
                <AlertCircle className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">
                  Não há indicações pendentes cadastradas.
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Para vincular este cliente como indicação, primeiro registre uma indicação pelo painel de clientes ou carteira.
                </p>
              </div>
            )}
          </>
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
