import { useState } from 'react';
import { MoreVertical, Eye, Merge, Trash2, DollarSign } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import { MergeCallDialog } from './MergeCallDialog';
import { MarkAsSoldDialog } from './MarkAsSoldDialog';
import { Call } from '@/types';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface CallCardMenuProps {
  call: Call;
  canDelete: boolean;
  onViewDetails: () => void;
  onCallUpdated: () => void;
  targetCloserId?: string;
}

export function CallCardMenu({ call, canDelete, onViewDetails, onCallUpdated, targetCloserId }: CallCardMenuProps) {
  const [showMergeDialog, setShowMergeDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showSoldDialog, setShowSoldDialog] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const isSold = call.status === 'vendido';

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const { error } = await supabase
        .from('calls')
        .delete()
        .eq('id', call.id);

      if (error) throw error;

      toast.success('Call excluída com sucesso');
      onCallUpdated();
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
      <DropdownMenu>
        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
          <DropdownMenuItem onClick={onViewDetails}>
            <Eye className="h-4 w-4 mr-2" />
            Ver detalhes
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setShowMergeDialog(true)}>
            <Merge className="h-4 w-4 mr-2" />
            Juntar com outra call
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setShowSoldDialog(true)} className="text-success focus:text-success">
            <DollarSign className="h-4 w-4 mr-2" />
            {isSold ? 'Editar venda' : 'Marcar como Vendida'}
          </DropdownMenuItem>
          {canDelete && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                onClick={() => setShowDeleteDialog(true)}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Excluir call
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Merge Dialog */}
      {showMergeDialog && (
        <MergeCallDialog
          currentCall={call}
          targetCloserId={targetCloserId}
          onMergeComplete={() => {
            setShowMergeDialog(false);
            onCallUpdated();
          }}
          open={showMergeDialog}
          onOpenChange={setShowMergeDialog}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent onClick={(e) => e.stopPropagation()}>
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
