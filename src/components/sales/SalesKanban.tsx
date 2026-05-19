import { useState, useCallback, useMemo } from 'react';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Trash2, Phone, Mail, Building2, DollarSign, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  SALES_PIPELINE_COLUMNS,
  useSalesPipeline,
  type SalesPipelineCard,
  type SalesPipelineStatus,
} from '@/hooks/useSalesPipeline';
import { useUserRole } from '@/hooks/useUserRole';

const fmtBRL = (v: number | null | undefined) =>
  v ? v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '—';

export function SalesKanban() {
  const { data: cards = [], isLoading, moveCard, deleteCard } = useSalesPipeline();
  const { isAdmin, isFinanceiro } = useUserRole();
  const canEdit = isAdmin || isFinanceiro;
  const [dragged, setDragged] = useState<SalesPipelineCard | null>(null);
  const [overCol, setOverCol] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const filteredCards = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return cards;
    return cards.filter(
      (c) =>
        c.name?.toLowerCase().includes(q) ||
        (c.email?.toLowerCase().includes(q) ?? false)
    );
  }, [cards, search]);

  const handleDrop = useCallback(
    async (e: React.DragEvent, status: SalesPipelineStatus) => {
      e.preventDefault();
      setOverCol(null);
      if (!canEdit) return;
      if (dragged && dragged.status !== status) {
        await moveCard.mutateAsync({ id: dragged.id, newStatus: status });
      }
      setDragged(null);
    },
    [dragged, moveCard, canEdit]
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por nome ou email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>
      <ScrollArea className="w-full">
        <div className="flex gap-4 pb-4 min-h-[60vh]">
          {SALES_PIPELINE_COLUMNS.map((col) => {
            const colCards = filteredCards.filter((c) => c.status === col.id);
          const total = colCards.reduce((s, c) => s + (Number(c.sale_value) || 0), 0);
          const isOver = overCol === col.id;
          return (
            <div
              key={col.id}
              onDragOver={(e) => {
                e.preventDefault();
                setOverCol(col.id);
              }}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node)) setOverCol(null);
              }}
              onDrop={(e) => handleDrop(e, col.id as SalesPipelineStatus)}
              className={cn(
                'flex-shrink-0 w-72 bg-muted/30 rounded-xl p-3 transition-colors',
                isOver && 'bg-muted ring-2 ring-primary'
              )}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className={cn('w-2 h-2 rounded-full', col.color)} />
                  <h3 className="font-semibold text-sm">{col.title}</h3>
                </div>
                <Badge variant="secondary">{colCards.length}</Badge>
              </div>
              {total > 0 && (
                <p className="text-xs text-muted-foreground mb-3">Total: {fmtBRL(total)}</p>
              )}
              <div className="space-y-2">
                {colCards.map((card) => (
                  <div
                    key={card.id}
                    draggable={canEdit}
                    onDragStart={(e) => {
                      if (!canEdit) {
                        e.preventDefault();
                        return;
                      }
                      setDragged(card);
                      e.dataTransfer.effectAllowed = 'move';
                    }}
                    onDragEnd={() => setDragged(null)}
                    className={cn(
                      'bg-card border rounded-lg p-3 hover:shadow-md transition-shadow group',
                      canEdit ? 'cursor-move' : 'cursor-default'
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-medium text-sm truncate flex-1">{card.name}</p>
                      {canEdit && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 opacity-0 group-hover:opacity-100"
                          onClick={() => {
                            if (confirm('Remover este cartão?')) deleteCard.mutate(card.id);
                          }}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      )}
                    </div>
                    {card.company && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                        <Building2 className="w-3 h-3" /> {card.company}
                      </p>
                    )}
                    {card.product_offered && (
                      <Badge variant="outline" className="text-[10px] mt-2">
                        {card.product_offered}
                      </Badge>
                    )}
                    {card.sale_value != null && (
                      <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1 mt-2">
                        <DollarSign className="w-3 h-3" /> {fmtBRL(Number(card.sale_value))}
                      </p>
                    )}
                    <div className="flex flex-wrap gap-2 mt-2 text-[11px] text-muted-foreground">
                      {card.phone && (
                        <span className="flex items-center gap-1">
                          <Phone className="w-3 h-3" /> {card.phone}
                        </span>
                      )}
                      {card.email && (
                        <span className="flex items-center gap-1 truncate max-w-[140px]">
                          <Mail className="w-3 h-3" /> {card.email}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
                {colCards.length === 0 && (
                  <p className="text-xs text-muted-foreground/60 text-center py-6">Vazio</p>
                )}
              </div>
            </div>
          );
        })}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </div>
  );
}
