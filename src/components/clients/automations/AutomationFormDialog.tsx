import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useAutomations, TRIGGER_TYPE_LABELS, ACTION_TYPE_LABELS } from '@/hooks/useAutomations';
import { useClientTags } from '@/hooks/useClientTags';
import { CRMAutomation, AutomationTriggerType, AutomationActionType, ClientStatus } from '@/types';

const COLUMN_OPTIONS: { value: ClientStatus; label: string }[] = [
  { value: 'call_realizada', label: 'Call Realizada' },
  { value: 'repitch', label: 'RePitch' },
  { value: 'pos_call_0_2', label: 'Pós Call 0-2 dias' },
  { value: 'pos_call_3_7', label: 'Pós Call 3-7 dias' },
  { value: 'pos_call_8_15', label: 'Pós Call 8-15 dias' },
  { value: 'pos_call_16_21', label: 'Pós Call 16-21 dias' },
  { value: 'sinal_compromisso', label: 'Sinal de Compromisso' },
  { value: 'venda_realizada', label: 'Venda Realizada' },
  { value: 'aluno_nao_fit', label: 'Aluno Não Fit' },
  { value: 'pos_21_carterizacao', label: 'Pós 21 dias (Carterização)' },
];

interface AutomationFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  automation?: CRMAutomation | null;
}

export default function AutomationFormDialog({ 
  open, 
  onOpenChange, 
  automation 
}: AutomationFormDialogProps) {
  const { createAutomation, updateAutomation } = useAutomations();
  const { tags } = useClientTags();
  const [saving, setSaving] = useState(false);

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [triggerType, setTriggerType] = useState<AutomationTriggerType>('days_in_column');
  const [triggerConfig, setTriggerConfig] = useState<Record<string, unknown>>({});
  const [actionType, setActionType] = useState<AutomationActionType>('move_to_column');
  const [actionConfig, setActionConfig] = useState<Record<string, unknown>>({});

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      if (automation) {
        setName(automation.name);
        setDescription(automation.description || '');
        setTriggerType(automation.trigger_type);
        setTriggerConfig(automation.trigger_config);
        setActionType(automation.action_type);
        setActionConfig(automation.action_config);
      } else {
        setName('');
        setDescription('');
        setTriggerType('days_in_column');
        setTriggerConfig({ column_id: 'pos_call_0_2', days: 3 });
        setActionType('move_to_column');
        setActionConfig({ column_id: 'pos_call_3_7' });
      }
    }
  }, [open, automation]);

  const handleSave = async () => {
    if (!name.trim()) return;
    
    setSaving(true);
    
    if (automation) {
      await updateAutomation(automation.id, {
        name: name.trim(),
        description: description.trim() || null,
        trigger_type: triggerType,
        trigger_config: triggerConfig,
        action_type: actionType,
        action_config: actionConfig
      });
    } else {
      await createAutomation(
        name.trim(),
        description.trim() || null,
        triggerType,
        triggerConfig,
        actionType,
        actionConfig
      );
    }
    
    setSaving(false);
    onOpenChange(false);
  };

  const renderTriggerConfig = () => {
    switch (triggerType) {
      case 'days_in_column':
        return (
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Coluna</Label>
              <Select
                value={(triggerConfig.column_id as string) || ''}
                onValueChange={(v) => setTriggerConfig({ ...triggerConfig, column_id: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {COLUMN_OPTIONS.map((col) => (
                    <SelectItem key={col.value} value={col.value}>{col.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Dias</Label>
              <Input
                type="number"
                min={1}
                value={(triggerConfig.days as number) || 1}
                onChange={(e) => setTriggerConfig({ ...triggerConfig, days: parseInt(e.target.value) || 1 })}
              />
            </div>
          </div>
        );
      case 'no_interaction':
        return (
          <div className="space-y-2">
            <Label>Dias sem interação</Label>
            <Input
              type="number"
              min={1}
              value={(triggerConfig.days as number) || 7}
              onChange={(e) => setTriggerConfig({ ...triggerConfig, days: parseInt(e.target.value) || 7 })}
            />
          </div>
        );
      case 'tag_added':
        return (
          <div className="space-y-2">
            <Label>Tag</Label>
            <Select
              value={(triggerConfig.tag_id as string) || ''}
              onValueChange={(v) => {
                const tag = tags.find(t => t.id === v);
                setTriggerConfig({ ...triggerConfig, tag_id: v, tag_name: tag?.name });
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione uma tag" />
              </SelectTrigger>
              <SelectContent>
                {tags.map((tag) => (
                  <SelectItem key={tag.id} value={tag.id}>{tag.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        );
      default:
        return null;
    }
  };

  const renderActionConfig = () => {
    switch (actionType) {
      case 'move_to_column':
        return (
          <div className="space-y-2">
            <Label>Mover para coluna</Label>
            <Select
              value={(actionConfig.column_id as string) || ''}
              onValueChange={(v) => setActionConfig({ ...actionConfig, column_id: v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {COLUMN_OPTIONS.map((col) => (
                  <SelectItem key={col.value} value={col.value}>{col.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        );
      case 'add_tag':
      case 'remove_tag':
        return (
          <div className="space-y-2">
            <Label>{actionType === 'add_tag' ? 'Adicionar tag' : 'Remover tag'}</Label>
            <Select
              value={(actionConfig.tag_id as string) || ''}
              onValueChange={(v) => {
                const tag = tags.find(t => t.id === v);
                setActionConfig({ ...actionConfig, tag_id: v, tag_name: tag?.name });
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione uma tag" />
              </SelectTrigger>
              <SelectContent>
                {tags.map((tag) => (
                  <SelectItem key={tag.id} value={tag.id}>{tag.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        );
      case 'mark_super_hot':
        return (
          <div className="flex items-center gap-3">
            <Switch
              checked={(actionConfig.value as boolean) ?? true}
              onCheckedChange={(v) => setActionConfig({ ...actionConfig, value: v })}
            />
            <Label>Marcar como Super Quente</Label>
          </div>
        );
      case 'send_notification':
        return (
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Título da notificação</Label>
              <Input
                value={(actionConfig.title as string) || ''}
                onChange={(e) => setActionConfig({ ...actionConfig, title: e.target.value })}
                placeholder="Ex: Cliente precisa de atenção"
              />
            </div>
            <div className="space-y-2">
              <Label>Mensagem</Label>
              <Textarea
                value={(actionConfig.message as string) || ''}
                onChange={(e) => setActionConfig({ ...actionConfig, message: e.target.value })}
                placeholder="Ex: O cliente está há muito tempo sem contato"
                rows={2}
              />
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {automation ? 'Editar Automação' : 'Nova Automação'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Basic info */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome da Automação *</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Avançar Pós-Call automaticamente"
              />
            </div>
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Descreva o que essa automação faz..."
                rows={2}
              />
            </div>
          </div>

          {/* Trigger */}
          <div className="space-y-4 p-4 bg-muted/50 rounded-lg">
            <h4 className="font-medium text-sm">Quando (Trigger)</h4>
            <div className="space-y-2">
              <Label>Tipo de trigger</Label>
              <Select
                value={triggerType}
                onValueChange={(v) => {
                  setTriggerType(v as AutomationTriggerType);
                  setTriggerConfig({});
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(TRIGGER_TYPE_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {renderTriggerConfig()}
          </div>

          {/* Action */}
          <div className="space-y-4 p-4 bg-muted/50 rounded-lg">
            <h4 className="font-medium text-sm">Então (Ação)</h4>
            <div className="space-y-2">
              <Label>Tipo de ação</Label>
              <Select
                value={actionType}
                onValueChange={(v) => {
                  setActionType(v as AutomationActionType);
                  setActionConfig({});
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(ACTION_TYPE_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {renderActionConfig()}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving || !name.trim()}>
            {saving ? 'Salvando...' : 'Salvar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
