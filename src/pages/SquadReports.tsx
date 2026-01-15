import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import MainLayout from '@/components/layout/MainLayout';
import StatsCard from '@/components/dashboard/StatsCard';
import { DateRangePicker } from '@/components/dashboard/DateRangePicker';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Users, 
  Phone, 
  Target, 
  DollarSign, 
  TrendingUp, 
  Star,
  Wallet,
  BarChart3,
  Crown
} from 'lucide-react';
import { DateRange } from 'react-day-picker';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { Navigate } from 'react-router-dom';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface Squad {
  id: string;
  name: string;
  member_count?: number;
}

interface MemberStats {
  user_id: string;
  full_name: string;
  role: string;
  totalCalls: number;
  totalSales: number;
  totalSaleValue: number;
  totalEntryValue: number;
  averageScore: number;
  conversionRate: number;
}

interface SquadStats {
  totalMembers: number;
  totalCalls: number;
  totalSales: number;
  totalSaleValue: number;
  totalEntryValue: number;
  averageScore: number;
  conversionRate: number;
}

export default function SquadReports() {
  const { user } = useAuth();
  const { isAdmin, isLeader, loading: roleLoading } = useUserRole();
  const [squads, setSquads] = useState<Squad[]>([]);
  const [selectedSquadId, setSelectedSquadId] = useState<string>('');
  const [memberStats, setMemberStats] = useState<MemberStats[]>([]);
  const [squadStats, setSquadStats] = useState<SquadStats>({
    totalMembers: 0,
    totalCalls: 0,
    totalSales: 0,
    totalSaleValue: 0,
    totalEntryValue: 0,
    averageScore: 0,
    conversionRate: 0,
  });
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date()),
  });

  useEffect(() => {
    if (user && (isAdmin || isLeader)) {
      fetchSquads();
    }
  }, [user, isAdmin, isLeader]);

  useEffect(() => {
    if (selectedSquadId && dateRange) {
      fetchSquadReport();
    }
  }, [selectedSquadId, dateRange]);

  const fetchSquads = async () => {
    try {
      let query = supabase.from('squads').select('id, name');
      
      // Leaders only see squads they're part of
      if (isLeader && !isAdmin) {
        const { data: memberSquads } = await supabase
          .from('squad_members')
          .select('squad_id')
          .eq('user_id', user!.id);
        
        if (memberSquads && memberSquads.length > 0) {
          const squadIds = memberSquads.map(m => m.squad_id);
          query = query.in('id', squadIds);
        }
      }
      
      const { data, error } = await query;
      if (error) throw error;
      
      setSquads(data || []);
      if (data && data.length > 0) {
        setSelectedSquadId(data[0].id);
      }
    } catch (error) {
      console.error('Error fetching squads:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSquadReport = async () => {
    if (!selectedSquadId) return;
    
    try {
      setLoading(true);
      
      // Get squad members with profiles and roles
      const { data: members, error: membersError } = await supabase
        .from('squad_members')
        .select('user_id')
        .eq('squad_id', selectedSquadId);
      
      if (membersError) throw membersError;
      if (!members || members.length === 0) {
        setMemberStats([]);
        setSquadStats({
          totalMembers: 0,
          totalCalls: 0,
          totalSales: 0,
          totalSaleValue: 0,
          totalEntryValue: 0,
          averageScore: 0,
          conversionRate: 0,
        });
        return;
      }
      
      const userIds = members.map(m => m.user_id);
      
      // Fetch profiles
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name')
        .in('user_id', userIds);
      
      // Fetch roles
      const { data: roles } = await supabase
        .from('user_roles')
        .select('user_id, role')
        .in('user_id', userIds);
      
      // Fetch calls for all members in date range
      let callsQuery = supabase
        .from('calls')
        .select('*')
        .in('closer_id', userIds);
      
      if (dateRange?.from) {
        callsQuery = callsQuery.gte('call_date', format(dateRange.from, 'yyyy-MM-dd'));
      }
      if (dateRange?.to) {
        callsQuery = callsQuery.lte('call_date', format(dateRange.to, 'yyyy-MM-dd'));
      }
      
      const { data: calls, error: callsError } = await callsQuery;
      if (callsError) throw callsError;

      // Fetch client sales for all members in date range
      let clientsQuery = supabase
        .from('clients')
        .select('*')
        .in('closer_id', userIds)
        .eq('is_sold', true);
      
      if (dateRange?.from) {
        clientsQuery = clientsQuery.gte('sold_at', format(dateRange.from, 'yyyy-MM-dd'));
      }
      if (dateRange?.to) {
        clientsQuery = clientsQuery.lte('sold_at', format(dateRange.to, 'yyyy-MM-dd'));
      }
      
      const { data: soldClients } = await clientsQuery;
      
      // Calculate stats per member
      const statsMap: Record<string, MemberStats> = {};
      
      userIds.forEach(userId => {
        const profile = profiles?.find(p => p.user_id === userId);
        const role = roles?.find(r => r.user_id === userId);
        const memberCalls = calls?.filter(c => c.closer_id === userId) || [];
        const soldCallsFromCalls = memberCalls.filter(c => c.status === 'vendido');
        const memberSoldClients = soldClients?.filter(c => c.closer_id === userId) || [];
        const callsWithScore = memberCalls.filter(c => c.score !== null);
        
        // Combine sales from calls and clients (avoid duplicates by using client sales as primary)
        const totalSalesFromClients = memberSoldClients.length;
        const totalSaleValueFromClients = memberSoldClients.reduce((acc, c) => acc + (Number(c.sale_value) || 0), 0);
        const totalEntryValueFromClients = memberSoldClients.reduce((acc, c) => acc + (Number(c.entry_value) || 0), 0);
        
        // Use client sales if available, otherwise fallback to call sales
        const totalSales = totalSalesFromClients > 0 ? totalSalesFromClients : soldCallsFromCalls.length;
        const totalSaleValue = totalSalesFromClients > 0 ? totalSaleValueFromClients : soldCallsFromCalls.reduce((acc, c) => acc + (Number(c.sale_value) || 0), 0);
        const totalEntryValue = totalSalesFromClients > 0 ? totalEntryValueFromClients : soldCallsFromCalls.reduce((acc, c) => acc + (Number(c.entry_value) || 0), 0);
        
        statsMap[userId] = {
          user_id: userId,
          full_name: profile?.full_name || 'Usuário',
          role: role?.role || 'closer',
          totalCalls: memberCalls.length,
          totalSales,
          totalSaleValue,
          totalEntryValue,
          averageScore: callsWithScore.length 
            ? Math.round((callsWithScore.reduce((acc, c) => acc + (c.score || 0), 0) / callsWithScore.length) * 10) / 10
            : 0,
          conversionRate: memberCalls.length > 0 
            ? Math.round((totalSales / memberCalls.length) * 100) 
            : 0,
        };
      });
      
      const memberStatsArray = Object.values(statsMap).sort((a, b) => b.totalSaleValue - a.totalSaleValue);
      setMemberStats(memberStatsArray);
      
      // Calculate aggregated squad stats
      const allCalls = calls || [];
      const allSoldClients = soldClients || [];
      const allCallsWithScore = allCalls.filter(c => c.score !== null);
      
      // Use client sales for totals
      const totalSales = allSoldClients.length > 0 ? allSoldClients.length : allCalls.filter(c => c.status === 'vendido').length;
      const totalSaleValue = allSoldClients.length > 0 
        ? allSoldClients.reduce((acc, c) => acc + (Number(c.sale_value) || 0), 0)
        : allCalls.filter(c => c.status === 'vendido').reduce((acc, c) => acc + (Number(c.sale_value) || 0), 0);
      const totalEntryValue = allSoldClients.length > 0
        ? allSoldClients.reduce((acc, c) => acc + (Number(c.entry_value) || 0), 0)
        : allCalls.filter(c => c.status === 'vendido').reduce((acc, c) => acc + (Number(c.entry_value) || 0), 0);
      
      setSquadStats({
        totalMembers: userIds.length,
        totalCalls: allCalls.length,
        totalSales,
        totalSaleValue,
        totalEntryValue,
        averageScore: allCallsWithScore.length 
          ? Math.round((allCallsWithScore.reduce((acc, c) => acc + (c.score || 0), 0) / allCallsWithScore.length) * 10) / 10
          : 0,
        conversionRate: allCalls.length > 0 
          ? Math.round((totalSales / allCalls.length) * 100) 
          : 0,
      });
      
    } catch (error) {
      console.error('Error fetching squad report:', error);
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

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'admin':
        return <Badge variant="destructive">Admin</Badge>;
      case 'lider':
        return <Badge className="bg-purple-500">Líder</Badge>;
      default:
        return <Badge variant="secondary">Closer</Badge>;
    }
  };

  if (roleLoading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </MainLayout>
    );
  }

  if (!isAdmin && !isLeader) {
    return <Navigate to="/" replace />;
  }

  return (
    <MainLayout>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-display font-bold flex items-center gap-2">
              <BarChart3 className="w-8 h-8" />
              Relatórios por Time
            </h1>
            <p className="text-muted-foreground mt-1">
              Métricas agregadas de desempenho dos membros
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-4">
            <Select value={selectedSquadId} onValueChange={setSelectedSquadId}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Selecione um time" />
              </SelectTrigger>
              <SelectContent>
                {squads.map((squad) => (
                  <SelectItem key={squad.id} value={squad.id}>
                    {squad.name}
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

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : squads.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Users className="w-12 h-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground text-center">
                Nenhum time encontrado.
                {isAdmin && " Crie times na página de Administração."}
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Squad Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <StatsCard
                title="Membros"
                value={squadStats.totalMembers}
                icon={Users}
                variant="default"
              />
              <StatsCard
                title="Total de Calls"
                value={squadStats.totalCalls}
                icon={Phone}
                variant="default"
              />
              <StatsCard
                title="Vendas Fechadas"
                value={squadStats.totalSales}
                subtitle={`${squadStats.conversionRate}% de conversão`}
                icon={Target}
                variant="success"
              />
              <StatsCard
                title="Nota Média"
                value={squadStats.averageScore ? `${squadStats.averageScore}/10` : '-'}
                icon={Star}
                variant="warning"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <StatsCard
                title="Valor Total Vendido"
                value={formatCurrency(squadStats.totalSaleValue)}
                icon={DollarSign}
                variant="accent"
              />
              <StatsCard
                title="Total de Entradas"
                value={formatCurrency(squadStats.totalEntryValue)}
                icon={Wallet}
                variant="success"
              />
            </div>

            {/* Top Performer */}
            {memberStats.length > 0 && memberStats[0].totalSaleValue > 0 && (
              <Card className="bg-gradient-to-r from-yellow-500/10 to-orange-500/10 border-yellow-500/30">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-yellow-600">
                    <Crown className="w-5 h-5" />
                    Top Performer do Período
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4">
                    <Avatar className="h-16 w-16">
                      <AvatarFallback className="text-xl bg-yellow-500 text-white">
                        {memberStats[0].full_name.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-xl font-semibold">{memberStats[0].full_name}</p>
                      <div className="flex gap-4 mt-1 text-muted-foreground">
                        <span>{memberStats[0].totalSales} vendas</span>
                        <span>{formatCurrency(memberStats[0].totalSaleValue)}</span>
                        <span>{memberStats[0].conversionRate}% conversão</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Members Table */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5" />
                  Desempenho Individual
                </CardTitle>
              </CardHeader>
              <CardContent>
                {memberStats.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    Nenhum membro neste squad
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Membro</TableHead>
                        <TableHead>Função</TableHead>
                        <TableHead className="text-right">Calls</TableHead>
                        <TableHead className="text-right">Vendas</TableHead>
                        <TableHead className="text-right">Conversão</TableHead>
                        <TableHead className="text-right">Nota Média</TableHead>
                        <TableHead className="text-right">Valor Vendido</TableHead>
                        <TableHead className="text-right">Entradas</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {memberStats.map((member, index) => (
                        <TableRow key={member.user_id}>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              {index === 0 && member.totalSaleValue > 0 && (
                                <Crown className="w-4 h-4 text-yellow-500" />
                              )}
                              <Avatar className="h-8 w-8">
                                <AvatarFallback>
                                  {member.full_name.charAt(0).toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              <span className="font-medium">{member.full_name}</span>
                            </div>
                          </TableCell>
                          <TableCell>{getRoleBadge(member.role)}</TableCell>
                          <TableCell className="text-right">{member.totalCalls}</TableCell>
                          <TableCell className="text-right">{member.totalSales}</TableCell>
                          <TableCell className="text-right">{member.conversionRate}%</TableCell>
                          <TableCell className="text-right">
                            {member.averageScore ? `${member.averageScore}/10` : '-'}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {formatCurrency(member.totalSaleValue)}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(member.totalEntryValue)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </MainLayout>
  );
}
