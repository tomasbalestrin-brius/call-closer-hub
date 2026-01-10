import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Settings, Tag, Zap } from 'lucide-react';
import TagManagementDialog from '../tags/TagManagementDialog';
import AutomationsDialog from '../automations/AutomationsDialog';

interface CRMSettingsButtonProps {
  onTagsChange?: () => void;
}

export default function CRMSettingsButton({ onTagsChange }: CRMSettingsButtonProps) {
  const [tagsDialogOpen, setTagsDialogOpen] = useState(false);
  const [automationsDialogOpen, setAutomationsDialogOpen] = useState(false);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon">
            <Settings className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => setTagsDialogOpen(true)}>
            <Tag className="h-4 w-4 mr-2" />
            Gerenciar Tags
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setAutomationsDialogOpen(true)}>
            <Zap className="h-4 w-4 mr-2" />
            Automações
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <TagManagementDialog 
        open={tagsDialogOpen} 
        onOpenChange={setTagsDialogOpen} 
      />
      
      <AutomationsDialog 
        open={automationsDialogOpen} 
        onOpenChange={setAutomationsDialogOpen}
      />
    </>
  );
}
