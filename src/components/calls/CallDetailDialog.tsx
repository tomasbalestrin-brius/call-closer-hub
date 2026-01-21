import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Phone, ExternalLink, UserPlus, Merge, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Call, CallStatus, TechnicalAnalysis } from '@/types';
import { MergeCallDialog } from './MergeCallDialog';

interface CallDetailDialogProps {
  call: Call | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCallUpdated?: () => void;
  canDelete?: boolean;
  targetCloserId?: string;
}

const statusConfig: Record<CallStatus, { label: string; className: string }> = {
  pendente: { label: 'Pendente', className: 'bg-secondary text-secondary-foreground' },
  em_andamento: { label: 'Em andamento', className: 'bg-info text-info-foreground' },
  follow_up: { label: 'Follow-up', className: 'bg-warning text-warning-foreground' },
  proposta_enviada: { label: 'Proposta enviada', className: 'bg-info text-info-foreground' },
  vendido: { label: 'Vendido', className: 'bg-success text-success-foreground' },
  perdido: { label: 'Perdido', className: 'bg-destructive text-destructive-foreground' },
};

export default function CallDetailDialog({ 
  call, 
  open, 
  onOpenChange, 
  onCallUpdated,
  canDelete = false,
  targetCloserId
}: CallDetailDialogProps) {
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);
  const [showMergeDialog, setShowMergeDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleting, setDeleting] = useState(false);

  if (!call) return null;

  const statusInfo = statusConfig[call.status];

  const handleViewClient = () => {
    if (call.client_id) {
      onOpenChange(false);
      navigate(`/clients/${call.client_id}`);
    }
  };

  const handleCreateClient = async () => {
    setCreating(true);
    try {
      const { data: newClient, error: clientError } = await supabase
        .from('clients')
        .insert({
          name: call.client_name,
          company: call.company_name || null,
          niche: call.niche || null,
          main_pain: call.main_pain || null,
          closer_id: call.closer_id,
          status: 'lead',
          source: 'manual'
        })
        .select()
        .single();

      if (clientError) throw clientError;

      const { error: updateError } = await supabase
        .from('calls')
        .update({ client_id: newClient.id })
        .eq('id', call.id);

      if (updateError) throw updateError;

      toast.success('Cliente criado com sucesso!');
      onCallUpdated?.();
      onOpenChange(false);
      navigate(`/clients/${newClient.id}`);
    } catch (error) {
      console.error('Erro ao criar cliente:', error);
      toast.error('Erro ao criar cliente');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const { error } = await supabase
        .from('calls')
        .delete()
        .eq('id', call.id);

      if (error) throw error;

      toast.success('Call excluída com sucesso');
      onCallUpdated?.();
      onOpenChange(false);
    } catch (error) {
      console.error('Error deleting call:', error);
      toast.error('Erro ao excluir call');
    } finally {
      setDeleting(false);
      setShowDeleteDialog(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <div className="flex items-center justify-between gap-4">
              <DialogTitle className="flex items-center gap-2">
                <Phone className="w-5 h-5" />
                Detalhes da Call: {call.client_name}
              </DialogTitle>
              <div className="flex items-center gap-2">
                {call.client_id ? (
                  <Button variant="outline" size="sm" onClick={handleViewClient}>
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Ver Cliente
                  </Button>
                ) : (
                  <Button variant="outline" size="sm" onClick={handleCreateClient} disabled={creating}>
                    <UserPlus className="w-4 h-4 mr-2" />
                    {creating ? 'Criando...' : 'Criar Cliente'}
                  </Button>
                )}
                <Button variant="outline" size="sm" onClick={() => setShowMergeDialog(true)}>
                  <Merge className="w-4 h-4 mr-2" />
                  Juntar Call
                </Button>
                {canDelete && (
                  <Button 
                    variant="destructive" 
                    size="sm" 
                    onClick={() => setShowDeleteDialog(true)}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Excluir
                  </Button>
                )}
              </div>
            </div>
          </DialogHeader>
          
          <ScrollArea className="max-h-[70vh]">
            <div className="space-y-4 mt-4">
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
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Merge Dialog */}
      {showMergeDialog && (
        <MergeCallDialog
          currentCall={call}
          onMergeComplete={() => {
            setShowMergeDialog(false);
            onCallUpdated?.();
          }}
          open={showMergeDialog}
          onOpenChange={setShowMergeDialog}
          targetCloserId={targetCloserId}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir call</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir a call de <strong>{call.client_name}</strong>? 
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? 'Excluindo...' : 'Excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
