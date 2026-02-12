import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { User, DollarSign, ShoppingBag, Target } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { DateRange } from 'react-day-picker';
import { format } from 'date-fns';

interface SalesListDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dateRange?: DateRange;
  selectedFunnel: string | null;
}

const formatCurrency = (value: number | null | undefined) => {
  if (!value) return '-';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0 }).format(value);
};

export default function SalesListDialog({ open, onOpenChange, dateRange, selectedFunnel }: SalesListDialogProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isAdmin, loading: roleLoading } = useUserRole();

  const { data: sales = [], isLoading } = useQuery({
    queryKey: ['sales-list', user?.id, dateRange?.from?.toISOString(), dateRange?.to?.toISOString(), selectedFunnel, isAdmin],
    queryFn: async () => {
      let query = supabase
        .from('clients')
        .select('id, name, niche, sale_value, entry_value, product_offered, sold_at, closer_id, profiles!clients_closer_id_fkey(full_name)')
        .eq('is_sold', true)
        .not('sold_at', 'is', null)
        .order('sold_at', { ascending: false });

      if (!isAdmin) query = query.eq('closer_id', user!.id);
      if (dateRange?.from) query = query.gte('sold_at', format(dateRange.from, 'yyyy-MM-dd'));
      if (dateRange?.to) query = query.lte('sold_at', format(dateRange.to, 'yyyy-MM-dd') + 'T23:59:59');
      if (selectedFunnel) query = query.eq('funnel_source', selectedFunnel);

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: open && !!user && !roleLoading,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Target className="w-5 h-5" />
            Vendas Fechadas ({sales.length})
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-2 mt-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
            </div>
          ) : sales.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Nenhuma venda no período</p>
          ) : (
            sales.map(sale => (
              <Card
                key={sale.id}
                className="cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => {
                  onOpenChange(false);
                  navigate(`/clients/${sale.id}`);
                }}
              >
                <CardContent className="p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                        <User className="w-4 h-4 text-muted-foreground" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{sale.name}</p>
                        {sale.niche && (
                          <p className="text-xs text-muted-foreground truncate">{sale.niche}</p>
                        )}
                        {isAdmin && (sale as any).profiles?.full_name && (
                          <p className="text-xs text-primary truncate">Closer: {(sale as any).profiles.full_name}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      {sale.product_offered && (
                        <Badge variant="outline" className="text-xs gap-1">
                          <ShoppingBag className="w-3 h-3" />
                          {sale.product_offered}
                        </Badge>
                      )}
                      <div className="text-right">
                        <p className="text-sm font-medium text-green-600 flex items-center gap-1">
                          <DollarSign className="w-3 h-3" />
                          {formatCurrency(sale.sale_value)}
                        </p>
                        {sale.entry_value && (
                          <p className="text-xs text-muted-foreground">
                            Entrada: {formatCurrency(sale.entry_value)}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
