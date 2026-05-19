import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { CheckSquare, X, ArrowRight, Square } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface BulkColumn {
  id: string;
  title: string;
}

interface BulkActionsBarProps {
  active: boolean;
  selectedCount: number;
  totalCount: number;
  columns: BulkColumn[];
  onToggleActive: () => void;
  onSelectAll: () => void;
  onClearSelection: () => void;
  onMoveTo: (columnId: string) => void;
  className?: string;
}

export function BulkActionsBar({
  active,
  selectedCount,
  totalCount,
  columns,
  onToggleActive,
  onSelectAll,
  onClearSelection,
  onMoveTo,
  className,
}: BulkActionsBarProps) {
  if (!active) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={onToggleActive}
        className={cn('gap-2', className)}
      >
        <CheckSquare className="w-4 h-4" />
        Selecionar
      </Button>
    );
  }

  const allSelected = selectedCount > 0 && selectedCount === totalCount;

  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-2 p-2 rounded-lg bg-primary/5 border border-primary/30',
        className
      )}
    >
      <span className="text-sm font-medium px-2">
        {selectedCount} selecionado{selectedCount === 1 ? '' : 's'}
      </span>
      <Button variant="ghost" size="sm" onClick={onSelectAll} className="gap-1">
        {allSelected ? <Square className="w-4 h-4" /> : <CheckSquare className="w-4 h-4" />}
        {allSelected ? 'Limpar' : `Todos (${totalCount})`}
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm" disabled={selectedCount === 0} className="gap-1">
            <ArrowRight className="w-4 h-4" />
            Mover para...
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="max-h-80 overflow-y-auto bg-popover z-50">
          {columns.map((col) => (
            <DropdownMenuItem key={col.id} onClick={() => onMoveTo(col.id)}>
              {col.title}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => {
          onClearSelection();
          onToggleActive();
        }}
        className="gap-1 ml-auto"
      >
        <X className="w-4 h-4" />
        Sair
      </Button>
    </div>
  );
}
