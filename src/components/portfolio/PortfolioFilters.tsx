import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { CalendarIcon, X } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import type { PortfolioFiltersState } from '@/pages/Portfolio';
import type { TicketType } from '@/types';

interface PortfolioFiltersProps {
  filters: PortfolioFiltersState;
  onFiltersChange: (filters: PortfolioFiltersState) => void;
}

export default function PortfolioFilters({ filters, onFiltersChange }: PortfolioFiltersProps) {
  const hasActiveFilters = 
    filters.ticketFilter !== 'all' || 
    filters.activityFilter !== 'all' || 
    filters.indicationFilter !== 'all' ||
    filters.dateRange.from !== undefined;
  
  const clearFilters = () => {
    onFiltersChange({
      ticketFilter: 'all',
      activityFilter: 'all',
      indicationFilter: 'all',
      dateRange: { from: undefined, to: undefined },
    });
  };
  
  return (
    <div className="flex flex-wrap items-center gap-3 p-4 bg-muted/30 rounded-lg border">
      {/* Period Filter */}
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              'justify-start text-left font-normal min-w-[200px]',
              !filters.dateRange.from && 'text-muted-foreground'
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {filters.dateRange.from ? (
              filters.dateRange.to ? (
                <>
                  {format(filters.dateRange.from, 'dd/MM/yy', { locale: ptBR })} -{' '}
                  {format(filters.dateRange.to, 'dd/MM/yy', { locale: ptBR })}
                </>
              ) : (
                format(filters.dateRange.from, 'dd/MM/yyyy', { locale: ptBR })
              )
            ) : (
              'Período de entrada'
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="range"
            selected={{ from: filters.dateRange.from, to: filters.dateRange.to }}
            onSelect={(range) =>
              onFiltersChange({
                ...filters,
                dateRange: { from: range?.from, to: range?.to },
              })
            }
            locale={ptBR}
            numberOfMonths={2}
          />
        </PopoverContent>
      </Popover>
      
      {/* Ticket Filter */}
      <Select
        value={filters.ticketFilter}
        onValueChange={(value: TicketType | 'all') =>
          onFiltersChange({ ...filters, ticketFilter: value })
        }
      >
        <SelectTrigger className="w-[140px]">
          <SelectValue placeholder="Ticket" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos os tickets</SelectItem>
          <SelectItem value="29_90">29,90</SelectItem>
          <SelectItem value="12k">12K</SelectItem>
          <SelectItem value="80k">80K</SelectItem>
        </SelectContent>
      </Select>
      
      {/* Activity Filter */}
      <Select
        value={filters.activityFilter}
        onValueChange={(value: PortfolioFiltersState['activityFilter']) =>
          onFiltersChange({ ...filters, activityFilter: value })
        }
      >
        <SelectTrigger className="w-[160px]">
          <SelectValue placeholder="Atividades" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todas atividades</SelectItem>
          <SelectItem value="with_activities">Com atividades</SelectItem>
          <SelectItem value="without_activities">Sem atividades</SelectItem>
          <SelectItem value="intensivo">Intensivo</SelectItem>
          <SelectItem value="mentoria">Mentoria</SelectItem>
          <SelectItem value="evento">Evento</SelectItem>
        </SelectContent>
      </Select>
      
      {/* Indication Filter */}
      <Select
        value={filters.indicationFilter}
        onValueChange={(value: PortfolioFiltersState['indicationFilter']) =>
          onFiltersChange({ ...filters, indicationFilter: value })
        }
      >
        <SelectTrigger className="w-[160px]">
          <SelectValue placeholder="Indicações" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todas indicações</SelectItem>
          <SelectItem value="with_indications">Com indicações</SelectItem>
          <SelectItem value="without_indications">Sem indicações</SelectItem>
        </SelectContent>
      </Select>
      
      {/* Clear Filters */}
      {hasActiveFilters && (
        <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1">
          <X className="w-4 h-4" />
          Limpar
        </Button>
      )}
    </div>
  );
}
