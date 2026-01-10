import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { useAutomations, TRIGGER_TYPE_LABELS, ACTION_TYPE_LABELS } from '@/hooks/useAutomations';
import AutomationFormDialog from './AutomationFormDialog';
import { Plus, Trash2, Zap, AlertCircle } from 'lucide-react';
import { CRMAutomation } from '@/types';

interface AutomationsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function AutomationsDialog({ open, onOpenChange }: AutomationsDialogProps) {
  const { automations, loading, toggleAutomation, deleteAutomation } = useAutomations();
  const [formOpen, setFormOpen] = useState(false);
  const [editingAutomation, setEditingAutomation] = useState<CRMAutomation | null>(null);

  const handleEdit = (automation: CRMAutomation) => {
    setEditingAutomation(automation);
    setFormOpen(true);
  };

  const handleCreate = () => {
    setEditingAutomation(null);
    setFormOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Tem certeza que deseja excluir esta automação?')) {
      await deleteAutomation(id);
    }
  };

  const formatTriggerDescription = (automation: CRMAutomation) => {
    const config = automation.trigger_config as Record<string, unknown>;
    switch (automation.trigger_type) {
      case 'days_in_column':
        return `${config.days} dias na coluna "${config.column_id}"`;
      case 'no_interaction':
        return `${config.days} dias sem interação`;
      case 'tag_added':
        return `Quando tag "${config.tag_name}" for adicionada`;
      default:
        return TRIGGER_TYPE_LABELS[automation.trigger_type];
    }
  };

  const formatActionDescription = (automation: CRMAutomation) => {
    const config = automation.action_config as Record<string, unknown>;
    switch (automation.action_type) {
      case 'move_to_column':
        return `Mover para "${config.column_id}"`;
      case 'add_tag':
        return `Adicionar tag "${config.tag_name}"`;
      case 'remove_tag':
        return `Remover tag "${config.tag_name}"`;
      case 'mark_super_hot':
        return config.value ? 'Marcar Super Quente' : 'Remover Super Quente';
      case 'send_notification':
        return `Notificar: "${config.title}"`;
      default:
        return ACTION_TYPE_LABELS[automation.action_type];
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-primary" />
              Automações do CRM
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-4">
            {/* Info */}
            <div className="flex items-start gap-2 p-3 bg-muted/50 rounded-lg text-sm">
              <AlertCircle className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
              <p className="text-muted-foreground">
                As automações são executadas automaticamente quando as condições são atendidas. 
                Crie regras para mover clientes entre colunas, adicionar tags e enviar notificações.
              </p>
            </div>

            {/* Automations list */}
            {loading ? (
              <p className="text-sm text-muted-foreground text-center py-8">Carregando...</p>
            ) : automations.length === 0 ? (
              <div className="text-center py-8">
                <Zap className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground mb-4">Nenhuma automação criada</p>
                <Button onClick={handleCreate}>
                  <Plus className="w-4 h-4 mr-2" />
                  Criar Primeira Automação
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {automations.map((automation) => (
                  <div
                    key={automation.id}
                    className="p-4 border rounded-lg bg-card hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium truncate">{automation.name}</h4>
                          <Switch
                            checked={automation.is_active}
                            onCheckedChange={() => toggleAutomation(automation.id)}
                          />
                        </div>
                        {automation.description && (
                          <p className="text-xs text-muted-foreground mt-1 truncate">
                            {automation.description}
                          </p>
                        )}
                        <div className="mt-2 text-xs space-y-1">
                          <p className="text-muted-foreground">
                            <span className="font-medium">Quando:</span> {formatTriggerDescription(automation)}
                          </p>
                          <p className="text-muted-foreground">
                            <span className="font-medium">Então:</span> {formatActionDescription(automation)}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(automation)}
                        >
                          Editar
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive"
                          onClick={() => handleDelete(automation.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          {automations.length > 0 && (
            <div className="pt-4 border-t">
              <Button onClick={handleCreate} className="w-full">
                <Plus className="w-4 h-4 mr-2" />
                Nova Automação
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AutomationFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        automation={editingAutomation}
      />
    </>
  );
}
