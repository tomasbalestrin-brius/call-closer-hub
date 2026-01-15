import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Phone, ExternalLink } from 'lucide-react';
import { Call, CallStatus, TechnicalAnalysis } from '@/types';

interface CallDetailDialogProps {
  call: Call | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const statusConfig: Record<CallStatus, { label: string; className: string }> = {
  pendente: { label: 'Pendente', className: 'bg-secondary text-secondary-foreground' },
  em_andamento: { label: 'Em andamento', className: 'bg-info text-info-foreground' },
  follow_up: { label: 'Follow-up', className: 'bg-warning text-warning-foreground' },
  proposta_enviada: { label: 'Proposta enviada', className: 'bg-info text-info-foreground' },
  vendido: { label: 'Vendido', className: 'bg-success text-success-foreground' },
  perdido: { label: 'Perdido', className: 'bg-destructive text-destructive-foreground' },
};

export default function CallDetailDialog({ call, open, onOpenChange }: CallDetailDialogProps) {
  const navigate = useNavigate();

  if (!call) return null;

  const statusInfo = statusConfig[call.status];

  const handleViewClient = () => {
    if (call.client_id) {
      onOpenChange(false);
      navigate(`/clients/${call.client_id}`);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <div className="flex items-center justify-between gap-4">
            <DialogTitle className="flex items-center gap-2">
              <Phone className="w-5 h-5" />
              Detalhes da Call: {call.client_name}
            </DialogTitle>
            {call.client_id && (
              <Button variant="outline" size="sm" onClick={handleViewClient}>
                <ExternalLink className="w-4 h-4 mr-2" />
                Ver Cliente
              </Button>
            )}
          </div>
        </DialogHeader>
        
        <ScrollArea className="max-h-[70vh]">
          <Tabs defaultValue="analysis" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="analysis">Análise</TabsTrigger>
              <TabsTrigger value="technical">Análise Técnica</TabsTrigger>
              <TabsTrigger value="transcription">Transcrição</TabsTrigger>
            </TabsList>
            
            <TabsContent value="analysis" className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Status</p>
                  <Badge className={statusInfo.className}>{statusInfo.label}</Badge>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Nota</p>
                  <p className="font-medium">{call.score || '-'}/10</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Data</p>
                  <p className="font-medium">
                    {format(new Date(call.call_date), "dd/MM/yyyy", { locale: ptBR })}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Produto</p>
                  <p className="font-medium">{call.product || '-'}</p>
                </div>
                {call.niche && (
                  <div>
                    <p className="text-sm text-muted-foreground">Nicho</p>
                    <p className="font-medium">{call.niche}</p>
                  </div>
                )}
                {call.sale_value && (
                  <div>
                    <p className="text-sm text-muted-foreground">Valor da Venda</p>
                    <p className="font-medium text-success">
                      {call.sale_value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </p>
                  </div>
                )}
              </div>
              
              {call.ai_summary && (
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Resumo da IA</p>
                  <p className="text-sm bg-muted p-3 rounded-lg">{call.ai_summary}</p>
                </div>
              )}
              
              {call.call_conclusion && (
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Conclusão</p>
                  <p className="text-sm bg-muted p-3 rounded-lg">{call.call_conclusion}</p>
                </div>
              )}
              
              {call.main_pain && (
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Principal Dor</p>
                  <p className="text-sm bg-muted p-3 rounded-lg">{call.main_pain}</p>
                </div>
              )}
              
              {call.main_errors && call.main_errors.length > 0 && (
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Principais Erros</p>
                  <ul className="list-disc list-inside text-sm space-y-1">
                    {call.main_errors.map((error, i) => (
                      <li key={i}>{error}</li>
                    ))}
                  </ul>
                </div>
              )}
              
              {call.main_wins && call.main_wins.length > 0 && (
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Principais Acertos</p>
                  <ul className="list-disc list-inside text-sm space-y-1">
                    {call.main_wins.map((win, i) => (
                      <li key={i}>{win}</li>
                    ))}
                  </ul>
                </div>
              )}

              {call.loss_point && (
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Ponto de Perda</p>
                  <p className="text-sm bg-destructive/10 text-destructive p-3 rounded-lg">{call.loss_point}</p>
                </div>
              )}

              {call.notes && (
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Observações</p>
                  <p className="text-sm bg-muted p-3 rounded-lg">{call.notes}</p>
                </div>
              )}
            </TabsContent>
            
            <TabsContent value="technical" className="mt-4">
              {call.technical_analysis ? (
                <div className="space-y-4">
                  {Object.entries(call.technical_analysis as TechnicalAnalysis).map(([key, value]) => {
                    if (typeof value === 'object' && value !== null) {
                      return (
                        <div key={key} className="border rounded-lg p-4">
                          <h4 className="font-medium mb-2 capitalize">
                            {key.replace(/_/g, ' ')}
                          </h4>
                          <pre className="text-xs bg-muted p-3 rounded overflow-x-auto">
                            {JSON.stringify(value, null, 2)}
                          </pre>
                        </div>
                      );
                    }
                    return null;
                  })}
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-8">
                  Análise técnica não disponível.
                </p>
              )}
            </TabsContent>
            
            <TabsContent value="transcription" className="mt-4">
              {call.transcription ? (
                <div className="bg-muted p-4 rounded-lg max-h-96 overflow-y-auto">
                  <pre className="text-sm whitespace-pre-wrap font-sans">
                    {call.transcription}
                  </pre>
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-8">
                  Transcrição não disponível.
                </p>
              )}
            </TabsContent>
          </Tabs>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
