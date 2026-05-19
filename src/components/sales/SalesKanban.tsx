import { useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Trash2, Phone, Mail, Building2, DollarSign, Search, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { BulkActionsBar } from '@/components/kanban/BulkActionsBar';
import {
  SALES_PIPELINE_COLUMNS,
  useSalesPipeline,
  type SalesPipelineCard,
  type SalesPipelineStatus,
} from '@/hooks/useSalesPipeline';
import { useUserRole } from '@/hooks/useUserRole';
import { useAuth } from '@/hooks/useAuth';

const fmtBRL = (v: number | null | undefined) =>
  v ? v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '—';

export function SalesKanban() {
  const { data: cards = [], isLoading, moveCard, deleteCard } = useSalesPipeline();
  const { isAdmin, isFinanceiro } = useUserRole();
  const { user } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const isPrivileged = isAdmin || isFinanceiro;
  const canDelete = isPrivileged;
  const canEditCard = useCallback(
    (card: SalesPipelineCard) => isPrivileged || card.closer_id === user?.id,
    [isPrivileged, user?.id]
  );
  const [dragged, setDragged] = useState<SalesPipelineCard | null>(null);
  const [overCol, setOverCol] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [closerFilter, setCloserFilter] = useState<string>('all');
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const closerOptions = useMemo(() => {
    if (!isPrivileged) return [];
    const map = new Map<string, string>();
    cards.forEach((c) => {
      if (c.closer_id && !map.has(c.closer_id)) {
        map.set(c.closer_id, c.closer_name || 'Sem nome');
      }
    });
    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [cards, isPrivileged]);

  const filteredCards = useMemo(() => {
    const q = search.trim().toLowerCase();
    return cards.filter((c) => {
      if (closerFilter !== 'all' && c.closer_id !== closerFilter) return false;
      if (!q) return true;
      return (
        c.name?.toLowerCase().includes(q) ||
        (c.email?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [cards, search, closerFilter]);

  const toggleSelected = (id: string) =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const selectableCards = useMemo(
    () => filteredCards.filter(canEditCard),
    [filteredCards, canEditCard]
  );

  const handleSelectAll = () => {
    if (selectedIds.size === selectableCards.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(selectableCards.map((c) => c.id)));
  };

  const handleBulkMove = async (status: string) => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    const { error } = await (supabase as any)
      .from('sales_pipeline')
      .update({ status })
      .in('id', ids);
    if (error) {
      toast.error('Erro ao mover');
      return;
    }
    toast.success(`${ids.length} cartão(s) movido(s)`);
    setSelectedIds(new Set());
    setSelectionMode(false);
    qc.invalidateQueries({ queryKey: ['sales-pipeline'] });
  };

  const handleDrop = useCallback(
    async (e: React.DragEvent, status: SalesPipelineStatus) => {
      e.preventDefault();
      setOverCol(null);
      if (dragged && canEditCard(dragged) && dragged.status !== status) {
        await moveCard.mutateAsync({ id: dragged.id, newStatus: status });
      }
      setDragged(null);
    },
    [dragged, moveCard, canEditCard]
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
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative max-w-md flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome ou email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        {isPrivileged && closerOptions.length > 0 && (
          <Select value={closerFilter} onValueChange={setCloserFilter}>
            <SelectTrigger className="w-[220px]">
              <User className="w-4 h-4 mr-2 text-muted-foreground" />
              <SelectValue placeholder="Filtrar por closer" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os closers</SelectItem>
              {closerOptions.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <BulkActionsBar
          active={selectionMode}
          selectedCount={selectedIds.size}
          totalCount={selectableCards.length}
          columns={SALES_PIPELINE_COLUMNS.map((c) => ({ id: c.id, title: c.title }))}
          onToggleActive={() => {
            setSelectionMode((v) => !v);
            if (selectionMode) setSelectedIds(new Set());
          }}
          onSelectAll={handleSelectAll}
          onClearSelection={() => setSelectedIds(new Set())}
          onMoveTo={handleBulkMove}
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
                  {colCards.map((card) => {
                    const isSelected = selectedIds.has(card.id);
                    const editable = canEditCard(card);
                    return (
                      <div
                        key={card.id}
                        draggable={editable && !selectionMode}
                        onDragStart={(e) => {
                          if (!editable || selectionMode) {
                            e.preventDefault();
                            return;
                          }
                          setDragged(card);
                          e.dataTransfer.effectAllowed = 'move';
                        }}
                        onDragEnd={() => setDragged(null)}
                        onClick={() => {
                          if (selectionMode) {
                            if (editable) toggleSelected(card.id);
                          } else if (card.client_id) {
                            navigate(`/clients/${card.client_id}`);
                          }
                        }}
                        className={cn(
                          'relative bg-card border rounded-lg p-3 hover:shadow-md transition-shadow group',
                          'cursor-pointer hover:border-primary/50',
                          selectionMode && !editable && 'opacity-50',
                          isSelected && selectionMode && 'ring-2 ring-primary'
                        )}
                      >
                        {selectionMode && editable && (
                          <div className="absolute top-2 left-2 z-10 bg-background rounded p-0.5 shadow">
                            <Checkbox checked={isSelected} className="pointer-events-none" />
                          </div>
                        )}
                        <div className="flex items-start justify-between gap-2">
                          <p className={cn('font-medium text-sm truncate flex-1', selectionMode && editable && 'pl-6')}>{card.name}</p>
                          {canDelete && !selectionMode && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 opacity-0 group-hover:opacity-100"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (confirm('Remover este cartão?')) deleteCard.mutate(card.id);
                              }}
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          )}
                        </div>

                        {isPrivileged && card.closer_name && (
                          <Badge variant="secondary" className="text-[10px] mt-1.5 gap-1">
                            <User className="w-2.5 h-2.5" />
                            {card.closer_name}
                          </Badge>
                        )}
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
                    );
                  })}
                  {colCards.length === 0 && (
                    <p className="text-xs text-muted-foreground/60 text-center py-6">Vazio</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        <ScrollBar orientation="horizontal" className="h-3" />
      </ScrollArea>
    </div>
  );
}
