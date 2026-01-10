import { useState } from 'react';
import { useClientTags, useClientTagAssignments } from '@/hooks/useClientTags';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import TagBadge from './TagBadge';
import TagManagementDialog from './TagManagementDialog';
import { Tag, Plus, Settings } from 'lucide-react';

interface TagSelectorProps {
  clientId: string;
  onTagsChange?: () => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export default function TagSelector({ clientId, onTagsChange, open: controlledOpen, onOpenChange }: TagSelectorProps) {
  const { tags, loading: tagsLoading } = useClientTags();
  const { assignments, toggleTag, loading: assignmentsLoading } = useClientTagAssignments(clientId);
  const [internalOpen, setInternalOpen] = useState(false);
  const [managementOpen, setManagementOpen] = useState(false);

  const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setOpen = onOpenChange || setInternalOpen;

  const handleToggle = async (tagId: string) => {
    const success = await toggleTag(tagId);
    if (success) {
      onTagsChange?.();
    }
  };

  const assignedTagIds = assignments.map(a => a.tag_id);
  const assignedTags = tags.filter(t => assignedTagIds.includes(t.id));

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-7 px-2 text-xs gap-1"
            onClick={(e) => e.stopPropagation()}
          >
            <Tag className="w-3 h-3" />
            Tags {assignedTags.length > 0 && `(${assignedTags.length})`}
          </Button>
        </PopoverTrigger>
        <PopoverContent 
          className="w-56 p-2" 
          align="start"
          onClick={(e) => e.stopPropagation()}
        >
          {tagsLoading || assignmentsLoading ? (
            <p className="text-xs text-muted-foreground p-2">Carregando...</p>
          ) : tags.length === 0 ? (
            <div className="text-center py-4">
              <p className="text-xs text-muted-foreground mb-2">Nenhuma tag criada</p>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => { setOpen(false); setManagementOpen(true); }}
              >
                <Plus className="w-3 h-3 mr-1" />
                Criar Tag
              </Button>
            </div>
          ) : (
            <>
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {tags.map((tag) => (
                  <label
                    key={tag.id}
                    className="flex items-center gap-2 p-2 rounded-md hover:bg-muted cursor-pointer"
                  >
                    <Checkbox
                      checked={assignedTagIds.includes(tag.id)}
                      onCheckedChange={() => handleToggle(tag.id)}
                    />
                    <TagBadge tag={tag} size="sm" />
                  </label>
                ))}
              </div>
              <div className="border-t mt-2 pt-2">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="w-full justify-start text-xs"
                  onClick={() => { setOpen(false); setManagementOpen(true); }}
                >
                  <Settings className="w-3 h-3 mr-2" />
                  Gerenciar Tags
                </Button>
              </div>
            </>
          )}
        </PopoverContent>
      </Popover>

      <TagManagementDialog 
        open={managementOpen} 
        onOpenChange={setManagementOpen} 
      />
    </>
  );
}
