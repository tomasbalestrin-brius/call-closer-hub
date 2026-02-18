import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from 'recharts';
import { DollarSign, Cpu, Hash, TrendingUp, Loader2 } from 'lucide-react';
import { format, subDays, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';

type PeriodFilter = '7d' | '30d' | '90d';

interface ApiCostRow {
  id: string;
  user_id: string;
  service: string;
  model: string;
  operation: string | null;
  tokens_input: number;
  tokens_output: number;
  estimated_cost_usd: number;
  call_id: string | null;
  file_id: string | null;
  created_at: string;
}

export default function CostDashboard() {
  const [costs, setCosts] = useState<ApiCostRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<PeriodFilter>('30d');
  const [profiles, setProfiles] = useState<Map<string, string>>(new Map());

  const periodDays = period === '7d' ? 7 : period === '30d' ? 30 : 90;
  const startDate = useMemo(() => subDays(new Date(), periodDays), [periodDays]);

  useEffect(() => {
    fetchCosts();
  }, [startDate]);

  const fetchCosts = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('api_costs' as any)
        .select('*')
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: false });

      if (error) throw error;

      const rows = (data || []) as unknown as ApiCostRow[];
      setCosts(rows);

      // Fetch profile names for unique user_ids
      const userIds = [...new Set(rows.map(r => r.user_id))];
      if (userIds.length > 0) {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('user_id, full_name')
          .in('user_id', userIds);

        const map = new Map<string, string>();
        (profileData || []).forEach(p => map.set(p.user_id, p.full_name));
        setProfiles(map);
      }
    } catch (error) {
      console.error('Error fetching costs:', error);
    } finally {
      setLoading(false);
    }
  };

  // Summary stats
  const totalCost = useMemo(() => costs.reduce((sum, c) => sum + Number(c.estimated_cost_usd), 0), [costs]);
  const totalTokens = useMemo(() => costs.reduce((sum, c) => sum + Number(c.tokens_input) + Number(c.tokens_output), 0), [costs]);
  const totalAnalyses = costs.length;
  const avgCostPerCall = totalAnalyses > 0 ? totalCost / totalAnalyses : 0;

  // By model
  const byModel = useMemo(() => {
    const map = new Map<string, { input: number; output: number; cost: number; count: number }>();
    costs.forEach(c => {
      const existing = map.get(c.model) || { input: 0, output: 0, cost: 0, count: 0 };
      existing.input += Number(c.tokens_input);
      existing.output += Number(c.tokens_output);
      existing.cost += Number(c.estimated_cost_usd);
      existing.count += 1;
      map.set(c.model, existing);
    });
    return Array.from(map.entries()).map(([model, data]) => ({ model, ...data }));
  }, [costs]);

  // Daily chart data
  const dailyData = useMemo(() => {
    const map = new Map<string, number>();
    // Initialize all days
    for (let i = 0; i < periodDays; i++) {
      const day = format(subDays(new Date(), i), 'yyyy-MM-dd');
      map.set(day, 0);
    }
    costs.forEach(c => {
      const day = format(new Date(c.created_at), 'yyyy-MM-dd');
      map.set(day, (map.get(day) || 0) + Number(c.estimated_cost_usd));
    });
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, cost]) => ({
        date: format(new Date(date), 'dd/MM', { locale: ptBR }),
        cost: Number(cost.toFixed(4)),
      }));
  }, [costs, periodDays]);

  // Top 5 closers by cost
  const topClosers = useMemo(() => {
    const map = new Map<string, { cost: number; count: number }>();
    costs.forEach(c => {
      const existing = map.get(c.user_id) || { cost: 0, count: 0 };
      existing.cost += Number(c.estimated_cost_usd);
      existing.count += 1;
      map.set(c.user_id, existing);
    });
    return Array.from(map.entries())
      .map(([userId, data]) => ({
        name: profiles.get(userId) || userId.slice(0, 8),
        ...data,
      }))
      .sort((a, b) => b.cost - a.cost)
      .slice(0, 5);
  }, [costs, profiles]);

  const chartConfig = {
    cost: { label: 'Custo (USD)', color: 'hsl(var(--primary))' },
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Period filter */}
      <div className="flex gap-2">
        {(['7d', '30d', '90d'] as PeriodFilter[]).map(p => (
          <Button
            key={p}
            variant={period === p ? 'default' : 'outline'}
            size="sm"
            onClick={() => setPeriod(p)}
          >
            {p === '7d' ? '7 dias' : p === '30d' ? '30 dias' : '90 dias'}
          </Button>
        ))}
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Custo Total</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${totalCost.toFixed(2)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Tokens</CardTitle>
            <Cpu className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalTokens.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Análises</CardTitle>
            <Hash className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalAnalyses}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Custo Médio/Call</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${avgCostPerCall.toFixed(4)}</div>
          </CardContent>
        </Card>
      </div>

      {/* By model table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Uso por Modelo</CardTitle>
        </CardHeader>
        <CardContent>
          {byModel.length === 0 ? (
            <p className="text-muted-foreground text-sm">Nenhum dado registrado ainda.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Modelo</TableHead>
                  <TableHead className="text-right">Chamadas</TableHead>
                  <TableHead className="text-right">Tokens Input</TableHead>
                  <TableHead className="text-right">Tokens Output</TableHead>
                  <TableHead className="text-right">Custo (USD)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {byModel.map(row => (
                  <TableRow key={row.model}>
                    <TableCell className="font-medium">{row.model}</TableCell>
                    <TableCell className="text-right">{row.count}</TableCell>
                    <TableCell className="text-right">{row.input.toLocaleString()}</TableCell>
                    <TableCell className="text-right">{row.output.toLocaleString()}</TableCell>
                    <TableCell className="text-right">${row.cost.toFixed(4)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Daily cost chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Custos Diários (USD)</CardTitle>
        </CardHeader>
        <CardContent>
          {dailyData.every(d => d.cost === 0) ? (
            <p className="text-muted-foreground text-sm">Nenhum dado registrado ainda. Os custos aparecerão aqui após novas análises.</p>
          ) : (
            <ChartContainer config={chartConfig} className="h-[300px] w-full">
              <BarChart data={dailyData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `$${v}`} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="cost" fill="var(--color-cost)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartContainer>
          )}
        </CardContent>
      </Card>

      {/* Top closers */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Top 5 Closers por Custo</CardTitle>
        </CardHeader>
        <CardContent>
          {topClosers.length === 0 ? (
            <p className="text-muted-foreground text-sm">Nenhum dado registrado ainda.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Closer</TableHead>
                  <TableHead className="text-right">Análises</TableHead>
                  <TableHead className="text-right">Custo (USD)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topClosers.map((closer, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium">{closer.name}</TableCell>
                    <TableCell className="text-right">{closer.count}</TableCell>
                    <TableCell className="text-right">${closer.cost.toFixed(4)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
