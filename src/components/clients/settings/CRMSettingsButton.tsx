import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Settings, Zap } from 'lucide-react';
import AutomationsDialog from '../automations/AutomationsDialog';

export default function CRMSettingsButton() {
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
          <DropdownMenuItem onClick={() => setAutomationsDialogOpen(true)}>
            <Zap className="h-4 w-4 mr-2" />
            Automações
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      
      <AutomationsDialog 
        open={automationsDialogOpen} 
        onOpenChange={setAutomationsDialogOpen}
      />
    </>
  );
}
