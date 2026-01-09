import { X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CallStatus } from '@/types';
import { DateRange } from 'react-day-picker';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ActiveFiltersChipsProps {
  searchQuery: string;
  statusFilter: CallStatus | 'all';
  dateRange: DateRange | undefined;
  onClearSearch: () => void;
  onClearStatus: () => void;
  onClearDateRange: () => void;
  onClearAll: () => void;
}

const statusLabels: Record<CallStatus, string> = {
  pendente: 'Pendente',
  em_andamento: 'Em andamento',
  follow_up: 'Follow-up',
  proposta_enviada: 'Proposta enviada',
  vendido: 'Vendido',
  perdido: 'Perdido',
};

export default function ActiveFiltersChips({
  searchQuery,
  statusFilter,
  dateRange,
  onClearSearch,
  onClearStatus,
  onClearDateRange,
  onClearAll,
}: ActiveFiltersChipsProps) {
  const hasFilters = searchQuery || statusFilter !== 'all' || dateRange?.from;

  if (!hasFilters) return null;

  const formatDateRange = () => {
    if (!dateRange?.from) return '';
    if (dateRange.to) {
      return `${format(dateRange.from, 'dd/MM', { locale: ptBR })} - ${format(dateRange.to, 'dd/MM', { locale: ptBR })}`;
    }
    return format(dateRange.from, 'dd/MM/yyyy', { locale: ptBR });
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm text-muted-foreground">Filtros ativos:</span>
      
      {searchQuery && (
        <Badge variant="secondary" className="gap-1 pr-1">
          Busca: "{searchQuery}"
          <button
            onClick={onClearSearch}
            className="ml-1 rounded-full p-0.5 hover:bg-muted-foreground/20"
          >
            <X className="w-3 h-3" />
          </button>
        </Badge>
      )}

      {statusFilter !== 'all' && (
        <Badge variant="secondary" className="gap-1 pr-1">
          Status: {statusLabels[statusFilter]}
          <button
            onClick={onClearStatus}
            className="ml-1 rounded-full p-0.5 hover:bg-muted-foreground/20"
          >
            <X className="w-3 h-3" />
          </button>
        </Badge>
      )}

      {dateRange?.from && (
        <Badge variant="secondary" className="gap-1 pr-1">
          Período: {formatDateRange()}
          <button
            onClick={onClearDateRange}
            className="ml-1 rounded-full p-0.5 hover:bg-muted-foreground/20"
          >
            <X className="w-3 h-3" />
          </button>
        </Badge>
      )}

      <Button
        variant="ghost"
        size="sm"
        onClick={onClearAll}
        className="text-muted-foreground hover:text-foreground"
      >
        Limpar todos
      </Button>
    </div>
  );
}
