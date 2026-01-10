import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useClientTags } from '@/hooks/useClientTags';
import TagBadge from './TagBadge';
import { Plus, Trash2 } from 'lucide-react';

const COLOR_OPTIONS = [
  '#ef4444', // red
  '#f97316', // orange
  '#eab308', // yellow
  '#22c55e', // green
  '#14b8a6', // teal
  '#3b82f6', // blue
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#6b7280', // gray
];

const ICON_OPTIONS = [
  { value: 'tag', label: 'Tag' },
  { value: 'star', label: 'Estrela' },
  { value: 'flame', label: 'Fogo' },
  { value: 'heart', label: 'Coração' },
  { value: 'zap', label: 'Raio' },
  { value: 'alert', label: 'Alerta' },
  { value: 'clock', label: 'Relógio' },
  { value: 'check', label: 'Check' },
];

interface TagManagementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function TagManagementDialog({ open, onOpenChange }: TagManagementDialogProps) {
  const { tags, loading, createTag, deleteTag } = useClientTags();
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState(COLOR_OPTIONS[0]);
  const [newTagIcon, setNewTagIcon] = useState('tag');
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    if (!newTagName.trim()) return;
    
    setCreating(true);
    const result = await createTag(newTagName.trim(), newTagColor, newTagIcon);
    setCreating(false);
    
    if (result) {
      setNewTagName('');
      setNewTagColor(COLOR_OPTIONS[0]);
      setNewTagIcon('tag');
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Tem certeza que deseja excluir esta tag? Ela será removida de todos os clientes.')) {
      await deleteTag(id);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Gerenciar Tags</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Create new tag */}
          <div className="space-y-4 p-4 bg-muted/50 rounded-lg">
            <div className="space-y-2">
              <Label>Nome da Tag</Label>
              <Input
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                placeholder="Ex: VIP, Urgente, Follow-up..."
                maxLength={20}
              />
            </div>

            <div className="space-y-2">
              <Label>Cor</Label>
              <div className="flex gap-2 flex-wrap">
                {COLOR_OPTIONS.map((color) => (
                  <button
                    key={color}
                    onClick={() => setNewTagColor(color)}
                    className={`w-8 h-8 rounded-full transition-transform ${
                      newTagColor === color ? 'ring-2 ring-offset-2 ring-foreground scale-110' : ''
                    }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Ícone</Label>
              <div className="flex gap-2 flex-wrap">
                {ICON_OPTIONS.map((icon) => (
                  <button
                    key={icon.value}
                    onClick={() => setNewTagIcon(icon.value)}
                    className={`px-3 py-1.5 text-xs rounded-md border transition-colors ${
                      newTagIcon === icon.value 
                        ? 'bg-primary text-primary-foreground border-primary' 
                        : 'bg-background border-border hover:bg-muted'
                    }`}
                  >
                    {icon.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Preview */}
            {newTagName && (
              <div className="pt-2">
                <Label className="text-muted-foreground">Preview:</Label>
                <div className="mt-1">
                  <TagBadge
                    tag={{
                      id: 'preview',
                      user_id: '',
                      name: newTagName,
                      color: newTagColor,
                      icon: newTagIcon,
                      created_at: ''
                    }}
                    size="md"
                  />
                </div>
              </div>
            )}

            <Button 
              onClick={handleCreate} 
              disabled={creating || !newTagName.trim()}
              className="w-full"
            >
              <Plus className="w-4 h-4 mr-2" />
              Criar Tag
            </Button>
          </div>

          {/* Existing tags */}
          <div className="space-y-2">
            <Label>Tags Existentes</Label>
            {loading ? (
              <p className="text-sm text-muted-foreground">Carregando...</p>
            ) : tags.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma tag criada ainda</p>
            ) : (
              <div className="space-y-2">
                {tags.map((tag) => (
                  <div 
                    key={tag.id}
                    className="flex items-center justify-between p-2 bg-muted/30 rounded-lg"
                  >
                    <TagBadge tag={tag} size="md" />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => handleDelete(tag.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
