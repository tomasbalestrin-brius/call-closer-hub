import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useColumnSettings } from '@/hooks/useColumnSettings';
import { RotateCcw } from 'lucide-react';

interface ColumnSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  columnId: string;
  defaultTitle: string;
  defaultSubtitle: string | null;
  onSave?: () => void;
}

export default function ColumnSettingsDialog({ 
  open, 
  onOpenChange, 
  columnId,
  defaultTitle,
  defaultSubtitle,
  onSave
}: ColumnSettingsDialogProps) {
  const { getColumnSettings, updateColumnSettings, resetColumnSettings } = useColumnSettings();
  const [customTitle, setCustomTitle] = useState('');
  const [customSubtitle, setCustomSubtitle] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      const settings = getColumnSettings(columnId);
      setCustomTitle(settings?.custom_title || '');
      setCustomSubtitle(settings?.custom_subtitle || '');
    }
  }, [open, columnId, getColumnSettings]);

  const handleSave = async () => {
    setSaving(true);
    const success = await updateColumnSettings(columnId, {
      custom_title: customTitle.trim() || null,
      custom_subtitle: customSubtitle.trim() || null
    });
    setSaving(false);
    
    if (success) {
      onSave?.();
      onOpenChange(false);
    }
  };

  const handleReset = async () => {
    setSaving(true);
    const success = await resetColumnSettings(columnId);
    setSaving(false);
    
    if (success) {
      setCustomTitle('');
      setCustomSubtitle('');
      onSave?.();
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm" onClick={(e) => e.stopPropagation()}>
        <DialogHeader>
          <DialogTitle>Configurar Coluna</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Título da Coluna</Label>
            <Input
              value={customTitle}
              onChange={(e) => setCustomTitle(e.target.value)}
              placeholder={defaultTitle}
              maxLength={30}
            />
            <p className="text-xs text-muted-foreground">
              Padrão: {defaultTitle}
            </p>
          </div>

          <div className="space-y-2">
            <Label>Subtítulo</Label>
            <Input
              value={customSubtitle}
              onChange={(e) => setCustomSubtitle(e.target.value)}
              placeholder={defaultSubtitle || 'Sem subtítulo'}
              maxLength={50}
            />
            {defaultSubtitle && (
              <p className="text-xs text-muted-foreground">
                Padrão: {defaultSubtitle}
              </p>
            )}
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={handleReset}
            disabled={saving}
            className="gap-2"
          >
            <RotateCcw className="w-4 h-4" />
            Restaurar Padrão
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Salvando...' : 'Salvar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
