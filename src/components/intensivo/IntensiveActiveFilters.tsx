import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { IntensiveLeadStatus, INTENSIVE_STATUS_LABELS } from '@/types/intensivo';

interface IntensiveActiveFiltersProps {
  searchQuery: string;
  statusFilter: IntensiveLeadStatus | 'all';
  sourceFilter: string;
  onClearSearch: () => void;
  onClearStatus: () => void;
  onClearSource: () => void;
  onClearAll: () => void;
}

export function IntensiveActiveFilters({
  searchQuery,
  statusFilter,
  sourceFilter,
  onClearSearch,
  onClearStatus,
  onClearSource,
  onClearAll,
}: IntensiveActiveFiltersProps) {
  const hasFilters = searchQuery || statusFilter !== 'all' || sourceFilter !== 'all';

  if (!hasFilters) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm text-muted-foreground">Filtros ativos:</span>
      
      {searchQuery && (
        <Badge variant="secondary" className="gap-1">
          Busca: "{searchQuery}"
          <button onClick={onClearSearch} className="ml-1 hover:text-destructive">
            <X className="w-3 h-3" />
          </button>
        </Badge>
      )}
      
      {statusFilter !== 'all' && (
        <Badge variant="secondary" className="gap-1">
          Status: {INTENSIVE_STATUS_LABELS[statusFilter]}
          <button onClick={onClearStatus} className="ml-1 hover:text-destructive">
            <X className="w-3 h-3" />
          </button>
        </Badge>
      )}
      
      {sourceFilter !== 'all' && (
        <Badge variant="secondary" className="gap-1">
          Origem: {sourceFilter}
          <button onClick={onClearSource} className="ml-1 hover:text-destructive">
            <X className="w-3 h-3" />
          </button>
        </Badge>
      )}
      
      <Button variant="ghost" size="sm" onClick={onClearAll} className="text-muted-foreground">
        Limpar todos
      </Button>
    </div>
  );
}
