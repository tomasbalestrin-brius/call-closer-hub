import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
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

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats>({
    totalCalls: 0,
    averageScore: 0,
    totalSales: 0,
    totalSaleValue: 0,
    totalEntryValue: 0,
    conversionRate: 0,
    offersByProduct: {
      elitePremium: 0,
      implementacaoComercial: 0,
      mentoriaJulia: 0,
      implementacaoIA: 0,
    },
  });
  const [loading, setLoading] = useState(true);
  const [selectedFunnel, setSelectedFunnel] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date()),
  });

  useEffect(() => {
    if (user) {
      fetchDashboardData();
    }
  }, [user, dateRange, selectedFunnel]);

  const fetchDashboardData = async () => {
    if (!user) return;

    try {
      setLoading(true);
      
      // First get client IDs if funnel filter is active
      let clientIdsForFunnel: string[] | null = null;
      if (selectedFunnel) {
        const { data: filteredClients } = await supabase
          .from('clients')
          .select('id')
          .eq('closer_id', user.id)
          .eq('funnel_source', selectedFunnel);
        clientIdsForFunnel = filteredClients?.map(c => c.id) || [];
      }
      
      // Build calls query with date filter
      let callsQuery = supabase
        .from('calls')
        .select('*')
        .eq('closer_id', user.id);

      if (dateRange?.from) {
        callsQuery = callsQuery.gte('call_date', format(dateRange.from, 'yyyy-MM-dd'));
      }
      if (dateRange?.to) {
        callsQuery = callsQuery.lte('call_date', format(dateRange.to, 'yyyy-MM-dd'));
      }
      
      // Filter calls by client_id if funnel is selected
      if (clientIdsForFunnel !== null) {
        if (clientIdsForFunnel.length === 0) {
          // No clients match funnel - return empty stats
          setStats({
            totalCalls: 0,
            averageScore: 0,
            totalSales: 0,
            totalSaleValue: 0,
            totalEntryValue: 0,
            conversionRate: 0,
            offersByProduct: { elitePremium: 0, implementacaoComercial: 0, mentoriaJulia: 0, implementacaoIA: 0 },
          });
          setLoading(false);
          return;
        }
        callsQuery = callsQuery.in('client_id', clientIdsForFunnel);
      }

      // Build clients query with date filter for sales
      let clientsQuery = supabase
        .from('clients')
        .select('*')
        .eq('closer_id', user.id)
        .eq('is_sold', true);

      if (dateRange?.from) {
        clientsQuery = clientsQuery.gte('sold_at', format(dateRange.from, 'yyyy-MM-dd'));
      }
      if (dateRange?.to) {
        clientsQuery = clientsQuery.lte('sold_at', format(dateRange.to, 'yyyy-MM-dd') + 'T23:59:59');
      }
      
      // Filter clients by funnel if selected
      if (selectedFunnel) {
        clientsQuery = clientsQuery.eq('funnel_source', selectedFunnel);
      }

      // Query for all clients with product_offered (for offers count)
      let allClientsQuery = supabase
        .from('clients')
        .select('id, product_offered')
        .eq('closer_id', user.id)
        .not('product_offered', 'is', null);

      if (dateRange?.from) {
        allClientsQuery = allClientsQuery.gte('created_at', format(dateRange.from, 'yyyy-MM-dd'));
      }
      if (dateRange?.to) {
        allClientsQuery = allClientsQuery.lte('created_at', format(dateRange.to, 'yyyy-MM-dd') + 'T23:59:59');
      }
      
      if (selectedFunnel) {
        allClientsQuery = allClientsQuery.eq('funnel_source', selectedFunnel);
      }

      const [callsResult, clientsResult, allClientsResult] = await Promise.all([
        callsQuery,
        clientsQuery,
        allClientsQuery
      ]);

      if (callsResult.error) throw callsResult.error;
      if (clientsResult.error) throw clientsResult.error;
      if (allClientsResult.error) throw allClientsResult.error;

      const calls = callsResult.data || [];
      const soldClients = clientsResult.data || [];
      const allClientsWithProduct = allClientsResult.data || [];

      // Calculate call-based stats
      const totalCalls = calls.length;
      const callsWithScore = calls.filter(c => c.score !== null);
      const averageScore = callsWithScore.length 
        ? callsWithScore.reduce((acc, c) => acc + (c.score || 0), 0) / callsWithScore.length 
        : 0;

      // Calculate sales from clients (manual sales)
      const totalSales = soldClients.length;
      const totalSaleValue = soldClients.reduce((acc, c) => acc + (Number(c.sale_value) || 0), 0);
      const totalEntryValue = soldClients.reduce((acc, c) => acc + (Number(c.entry_value) || 0), 0);
      const conversionRate = totalCalls > 0 ? (totalSales / totalCalls) * 100 : 0;

      // Count offers by product from clients.product_offered
      const offersByProduct = {
        elitePremium: allClientsWithProduct.filter(c => 
          c.product_offered?.toLowerCase().includes('elite') || 
          c.product_offered?.toLowerCase().includes('80k')
        ).length,
        implementacaoComercial: allClientsWithProduct.filter(c => 
          c.product_offered?.toLowerCase().includes('implementação comercial') || 
          c.product_offered?.toLowerCase().includes('implementacao comercial') ||
          c.product_offered?.toLowerCase().includes('programa comercial') ||
          c.product_offered?.toLowerCase().includes('programa de implementação')
        ).length,
        mentoriaJulia: allClientsWithProduct.filter(c => 
          c.product_offered?.toLowerCase().includes('mentoria') ||
          c.product_offered?.toLowerCase().includes('julia') ||
          c.product_offered?.toLowerCase().includes('cleiton')
        ).length,
        implementacaoIA: allClientsWithProduct.filter(c => 
          c.product_offered?.toLowerCase().includes('ia') || 
          c.product_offered?.toLowerCase().includes('inteligência artificial') ||
          c.product_offered?.toLowerCase().includes('inteligencia artificial')
        ).length,
      };

      setStats({
        totalCalls,
        averageScore: Math.round(averageScore * 10) / 10,
        totalSales,
        totalSaleValue,
        totalEntryValue,
        conversionRate: Math.round(conversionRate),
        offersByProduct,
      });

    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

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
          <StatsCard
            title="Total de Calls"
            value={stats.totalCalls}
            icon={Phone}
            variant="default"
          />
          <StatsCard
            title="Vendas Fechadas"
            value={stats.totalSales}
            icon={Target}
            variant="success"
          />
          <StatsCard
            title="Taxa de Conversão"
            value={`${stats.conversionRate}%`}
            icon={TrendingUp}
            variant="default"
          />
          <StatsCard
            title="Valor Total Vendido"
            value={formatCurrency(stats.totalSaleValue)}
            icon={DollarSign}
            variant="accent"
          />
          <StatsCard
            title="Total de Entradas"
            value={formatCurrency(stats.totalEntryValue)}
            icon={Wallet}
            variant="success"
          />
          <StatsCard
            title="Nota Média de Calls"
            value={stats.averageScore ? `${stats.averageScore}/10` : '-'}
            icon={Star}
            variant="warning"
          />
        </div>

        {/* Offers by Product */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-foreground">Número de Ofertas por Produto</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <StatsCard
              title="Elite Premium"
              value={stats.offersByProduct.elitePremium}
              icon={Crown}
              variant="accent"
            />
            <StatsCard
              title="Implementação Comercial"
              value={stats.offersByProduct.implementacaoComercial}
              icon={Briefcase}
              variant="default"
            />
            <StatsCard
              title="Mentoria Premium Julia"
              value={stats.offersByProduct.mentoriaJulia}
              icon={GraduationCap}
              variant="success"
            />
            <StatsCard
              title="Implementação de IA"
              value={stats.offersByProduct.implementacaoIA}
              icon={Bot}
              variant="warning"
            />
          </div>
        </div>

      </div>
    </MainLayout>
  );
}
