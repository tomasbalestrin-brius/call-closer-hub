import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { useQuery } from '@tanstack/react-query';
import MainLayout from '@/components/layout/MainLayout';
import StatsCard from '@/components/dashboard/StatsCard';
import DashboardHeader from '@/components/dashboard/DashboardHeader';
import DailyVerse from '@/components/dashboard/DailyVerse';
import QuotaProgressBar from '@/components/dashboard/QuotaProgressBar';
import MonthlyGoalBar from '@/components/dashboard/MonthlyGoalBar';
import { DateRangePicker } from '@/components/dashboard/DateRangePicker';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Phone, Star, TrendingUp, DollarSign, Wallet, Target, Crown, Briefcase, GraduationCap, Bot } from 'lucide-react';
import { DashboardStats, FUNNEL_SOURCES } from '@/types';
import { DateRange } from 'react-day-picker';
import { format, startOfMonth, endOfMonth } from 'date-fns';

const emptyStats: DashboardStats = {
  totalCalls: 0,
  averageScore: 0,
  totalSales: 0,
  totalSaleValue: 0,
  totalEntryValue: 0,
  conversionRate: 0,
  offersByProduct: { elitePremium: 0, implementacaoComercial: 0, mentoriaJulia: 0, implementacaoIA: 0 },
  salesByProduct: { elitePremium: 0, implementacaoComercial: 0, mentoriaJulia: 0, implementacaoIA: 0 },
};

export default function Dashboard() {
  const { user } = useAuth();
  const { isAdmin } = useUserRole();
  const [selectedFunnel, setSelectedFunnel] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date()),
  });

  const { data: stats = emptyStats, isLoading: loading } = useQuery({
    queryKey: ['dashboard-stats', user?.id, dateRange?.from?.toISOString(), dateRange?.to?.toISOString(), selectedFunnel, isAdmin],
    queryFn: async (): Promise<DashboardStats> => {
      if (!user) return emptyStats;

      // First get client IDs if funnel filter is active
      let clientIdsForFunnel: string[] | null = null;
      if (selectedFunnel) {
        let funnelQuery = supabase
          .from('clients')
          .select('id')
          .eq('funnel_source', selectedFunnel);
        if (!isAdmin) {
          funnelQuery = funnelQuery.eq('closer_id', user.id);
        }
        const { data: filteredClients } = await funnelQuery;
        clientIdsForFunnel = filteredClients?.map(c => c.id) || [];
      }

      // Build calls query with date filter
      let callsQuery = supabase
        .from('calls')
        .select('id, score, status, client_id, call_date, sale_value, entry_value, product');

      if (!isAdmin) {
        callsQuery = callsQuery.eq('closer_id', user.id);
      }
      if (dateRange?.from) {
        callsQuery = callsQuery.gte('call_date', format(dateRange.from, 'yyyy-MM-dd'));
      }
      if (dateRange?.to) {
        callsQuery = callsQuery.lte('call_date', format(dateRange.to, 'yyyy-MM-dd'));
      }

      if (clientIdsForFunnel !== null) {
        if (clientIdsForFunnel.length === 0) return emptyStats;
        callsQuery = callsQuery.in('client_id', clientIdsForFunnel);
      }

      // Build clients query with date filter for sales
      let clientsQuery = supabase
        .from('clients')
        .select('id, sale_value, entry_value, product_offered, funnel_source, sold_at, closer_id')
        .eq('is_sold', true);

      if (!isAdmin) {
        clientsQuery = clientsQuery.eq('closer_id', user.id);
      }

      if (dateRange?.from) {
        clientsQuery = clientsQuery.gte('sold_at', format(dateRange.from, 'yyyy-MM-dd'));
      }
      if (dateRange?.to) {
        clientsQuery = clientsQuery.lte('sold_at', format(dateRange.to, 'yyyy-MM-dd') + 'T23:59:59');
      }
      if (selectedFunnel) {
        clientsQuery = clientsQuery.eq('funnel_source', selectedFunnel);
      }

      // Query for all clients with product_offered
      let allClientsQuery = supabase
        .from('clients')
        .select('id, product_offered')
        .not('product_offered', 'is', null);

      if (!isAdmin) {
        allClientsQuery = allClientsQuery.eq('closer_id', user.id);
      }

      if (dateRange?.from) {
        allClientsQuery = allClientsQuery.gte('created_at', format(dateRange.from, 'yyyy-MM-dd'));
      }
      if (dateRange?.to) {
        allClientsQuery = allClientsQuery.lte('created_at', format(dateRange.to, 'yyyy-MM-dd') + 'T23:59:59');
      }
      if (selectedFunnel) {
        allClientsQuery = allClientsQuery.eq('funnel_source', selectedFunnel);
      }

      let repitchClientsQuery = supabase
        .from('clients')
        .select('id')
        .eq('status', 'repitch');

      if (!isAdmin) {
        repitchClientsQuery = repitchClientsQuery.eq('closer_id', user.id);
      }
      const [callsResult, clientsResult, allClientsResult, repitchClientsResult] = await Promise.all([
        callsQuery,
        clientsQuery,
        allClientsQuery,
        repitchClientsQuery
      ]);

      if (callsResult.error) throw callsResult.error;
      if (clientsResult.error) throw clientsResult.error;
      if (allClientsResult.error) throw allClientsResult.error;

      const calls = callsResult.data || [];
      const soldClients = clientsResult.data || [];
      const allClientsWithProduct = allClientsResult.data || [];
      const repitchClientIds = new Set(repitchClientsResult.data?.map(c => c.id) || []);

      const totalCalls = calls.length;
      const callsForAverage = calls.filter(c =>
        c.score !== null &&
        (!c.client_id || !repitchClientIds.has(c.client_id))
      );
      const averageScore = callsForAverage.length
        ? callsForAverage.reduce((acc, c) => acc + (c.score || 0), 0) / callsForAverage.length
        : 0;

      const totalSales = soldClients.length;
      const totalSaleValue = soldClients.reduce((acc, c) => acc + (Number(c.sale_value) || 0), 0);
      const totalEntryValue = soldClients.reduce((acc, c) => acc + (Number(c.entry_value) || 0), 0);
      const conversionRate = totalCalls > 0 ? (totalSales / totalCalls) * 100 : 0;

      const offersByProduct = {
        elitePremium: allClientsWithProduct.filter(c => c.product_offered === 'Mentoria Elite Premium').length,
        implementacaoComercial: allClientsWithProduct.filter(c => c.product_offered === 'Implementacao Comercial').length,
        mentoriaJulia: allClientsWithProduct.filter(c => c.product_offered === 'Mentoria Premium').length,
        implementacaoIA: allClientsWithProduct.filter(c => c.product_offered === 'Implementacao de IA').length,
      };

      const salesByProduct = {
        elitePremium: soldClients.filter(c => c.product_offered === 'Mentoria Elite Premium').length,
        implementacaoComercial: soldClients.filter(c => c.product_offered === 'Implementacao Comercial').length,
        mentoriaJulia: soldClients.filter(c => c.product_offered === 'Mentoria Premium').length,
        implementacaoIA: soldClients.filter(c => c.product_offered === 'Implementacao de IA').length,
      };

      return {
        totalCalls,
        averageScore: Math.round(averageScore * 10) / 10,
        totalSales,
        totalSaleValue,
        totalEntryValue,
        conversionRate: Math.round(conversionRate),
        offersByProduct,
        salesByProduct,
      };
    },
    staleTime: 30_000,
    enabled: !!user,
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  return (
    <MainLayout>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <DashboardHeader />
          <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
            <Select
              value={selectedFunnel || 'all'}
              onValueChange={(value) => setSelectedFunnel(value === 'all' ? null : value)}
            >
              <SelectTrigger className="w-[220px]">
                <SelectValue placeholder="Todos os Funis" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Funis</SelectItem>
                {FUNNEL_SOURCES.map((funnel) => (
                  <SelectItem key={funnel} value={funnel}>
                    {funnel}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <DateRangePicker
              dateRange={dateRange}
              onDateRangeChange={setDateRange}
            />
          </div>
        </div>

        {/* Daily Verse */}
        <DailyVerse />

        {/* Progress Bars */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <QuotaProgressBar />
          <MonthlyGoalBar />
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <StatsCard title="Total de Calls" value={stats.totalCalls} icon={Phone} variant="default" />
          <StatsCard title="Vendas Fechadas" value={stats.totalSales} icon={Target} variant="success" />
          <StatsCard title="Taxa de Conversão" value={`${stats.conversionRate}%`} icon={TrendingUp} variant="default" />
          <StatsCard title="Valor Total Vendido" value={formatCurrency(stats.totalSaleValue)} icon={DollarSign} variant="accent" />
          <StatsCard title="Total de Entradas" value={formatCurrency(stats.totalEntryValue)} icon={Wallet} variant="success" />
          <StatsCard title="Nota Média de Calls" value={stats.averageScore ? `${stats.averageScore}/10` : '-'} icon={Star} variant="warning" />
        </div>

        {/* Offers by Product */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-foreground">Número de Ofertas por Produto</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <StatsCard
              title="Elite Premium"
              value={stats.offersByProduct.elitePremium}
              subtitle={`${stats.offersByProduct.elitePremium} calls | ${stats.salesByProduct.elitePremium} vendas | ${stats.offersByProduct.elitePremium > 0 ? Math.round((stats.salesByProduct.elitePremium / stats.offersByProduct.elitePremium) * 100) : 0}% conversão`}
              icon={Crown}
              variant="accent"
            />
            <StatsCard
              title="Implementação Comercial"
              value={stats.offersByProduct.implementacaoComercial}
              subtitle={`${stats.offersByProduct.implementacaoComercial} calls | ${stats.salesByProduct.implementacaoComercial} vendas | ${stats.offersByProduct.implementacaoComercial > 0 ? Math.round((stats.salesByProduct.implementacaoComercial / stats.offersByProduct.implementacaoComercial) * 100) : 0}% conversão`}
              icon={Briefcase}
              variant="default"
            />
            <StatsCard
              title="Mentoria Premium Julia"
              value={stats.offersByProduct.mentoriaJulia}
              subtitle={`${stats.offersByProduct.mentoriaJulia} calls | ${stats.salesByProduct.mentoriaJulia} vendas | ${stats.offersByProduct.mentoriaJulia > 0 ? Math.round((stats.salesByProduct.mentoriaJulia / stats.offersByProduct.mentoriaJulia) * 100) : 0}% conversão`}
              icon={GraduationCap}
              variant="success"
            />
            <StatsCard
              title="Implementação de IA"
              value={stats.offersByProduct.implementacaoIA}
              subtitle={`${stats.offersByProduct.implementacaoIA} calls | ${stats.salesByProduct.implementacaoIA} vendas | ${stats.offersByProduct.implementacaoIA > 0 ? Math.round((stats.salesByProduct.implementacaoIA / stats.offersByProduct.implementacaoIA) * 100) : 0}% conversão`}
              icon={Bot}
              variant="warning"
            />
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
