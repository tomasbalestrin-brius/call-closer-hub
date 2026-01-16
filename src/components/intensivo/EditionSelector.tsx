import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { IntensiveEdition } from '@/types/intensivo';
import { safeDate } from '@/lib/dateUtils';

interface EditionSelectorProps {
  editions: IntensiveEdition[];
  selectedEditionId: string | null;
  onSelect: (editionId: string) => void;
  loading?: boolean;
}

export function EditionSelector({ 
  editions, 
  selectedEditionId, 
  onSelect, 
  loading 
}: EditionSelectorProps) {
  if (loading) {
    return (
      <div className="w-64 h-10 bg-muted animate-pulse rounded-md" />
    );
  }

  const formatEditionDate = (dateString: string) => {
    const date = safeDate(dateString);
    if (!date) return 'Data inválida';
    return format(date, 'dd/MM/yyyy', { locale: ptBR });
  };

  return (
    <Select value={selectedEditionId || ''} onValueChange={onSelect}>
      <SelectTrigger className="w-64">
        <SelectValue placeholder="Selecione uma edição" />
      </SelectTrigger>
      <SelectContent>
        {editions.map((edition) => (
          <SelectItem key={edition.id} value={edition.id}>
            <div className="flex items-center gap-2">
              <span>{edition.name}</span>
              <span className="text-xs text-muted-foreground">
                ({formatEditionDate(edition.event_date)})
              </span>
              {!edition.is_active && (
                <span className="text-xs bg-muted px-1.5 py-0.5 rounded">Encerrado</span>
              )}
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
