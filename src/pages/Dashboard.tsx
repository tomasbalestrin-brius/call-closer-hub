import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import MainLayout from '@/components/layout/MainLayout';
import StatsCard from '@/components/dashboard/StatsCard';
import DashboardHeader from '@/components/dashboard/DashboardHeader';
import DailyVerse from '@/components/dashboard/DailyVerse';
import QuotaProgressBar from '@/components/dashboard/QuotaProgressBar';
import MonthlyGoalBar from '@/components/dashboard/MonthlyGoalBar';
import CallCard from '@/components/calls/CallCard';
import { DateRangePicker } from '@/components/dashboard/DateRangePicker';
import { Phone, Star, TrendingUp, DollarSign, Wallet, Target } from 'lucide-react';
import { DashboardStats, Call } from '@/types';
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
  });
  const [recentCalls, setRecentCalls] = useState<Call[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date()),
  });

  useEffect(() => {
    if (user) {
      fetchDashboardData();
    }
  }, [user, dateRange]);

  const fetchDashboardData = async () => {
    if (!user) return;

    try {
      setLoading(true);
      
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

      const [callsResult, clientsResult] = await Promise.all([
        callsQuery,
        clientsQuery
      ]);

      if (callsResult.error) throw callsResult.error;
      if (clientsResult.error) throw clientsResult.error;

      const calls = callsResult.data || [];
      const soldClients = clientsResult.data || [];

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

      setStats({
        totalCalls,
        averageScore: Math.round(averageScore * 10) / 10,
        totalSales,
        totalSaleValue,
        totalEntryValue,
        conversionRate: Math.round(conversionRate),
      });

      // Get recent calls
      const recent = [...calls]
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 5) as Call[];
      setRecentCalls(recent);
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
          <DateRangePicker 
            dateRange={dateRange} 
            onDateRangeChange={setDateRange} 
          />
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
            title="Nota Média"
            value={stats.averageScore ? `${stats.averageScore}/10` : '-'}
            icon={Star}
            variant="warning"
          />
          <StatsCard
            title="Vendas Fechadas"
            value={stats.totalSales}
            subtitle={`${stats.conversionRate}% de conversão`}
            icon={Target}
            variant="success"
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
            title="Taxa de Conversão"
            value={`${stats.conversionRate}%`}
            icon={TrendingUp}
            variant="default"
          />
        </div>

        {/* Recent Calls */}
        <div>
          <h2 className="text-xl font-display font-semibold mb-4">Calls Recentes</h2>
          {loading ? (
            <div className="text-muted-foreground">Carregando...</div>
          ) : recentCalls.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {recentCalls.map((call) => (
                <CallCard key={call.id} call={call} />
              ))}
            </div>
          ) : (
            <div className="text-center py-12 bg-card rounded-xl border">
              <Phone className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">Nenhuma call registrada ainda</p>
              <p className="text-sm text-muted-foreground mt-1">
                Vá para a página de Calls para adicionar sua primeira call
              </p>
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  );
}
