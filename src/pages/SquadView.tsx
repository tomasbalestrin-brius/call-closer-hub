import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import MainLayout from '@/components/layout/MainLayout';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import CallDetailDialog from '@/components/calls/CallDetailDialog';
import { CallCardMenu } from '@/components/calls/CallCardMenu';
import { toast } from 'sonner';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  Users, 
  Phone, 
  TrendingUp, 
  Star, 
  Target, 
  DollarSign,
  Calendar,
  FileText,
  Eye,
  ChevronRight,
  RefreshCw,
  AlertTriangle
} from 'lucide-react';
import { Call, TechnicalAnalysis } from '@/types';
import { SetMonthlyGoalDialog } from '@/components/admin/SetMonthlyGoalDialog';
import { DateRangePicker } from '@/components/dashboard/DateRangePicker';
import StatsCard from '@/components/dashboard/StatsCard';

interface SquadMember {
  id: string;
  user_id: string;
  full_name: string;
  role: string;
}

interface CloserStats {
  totalCalls: number;
  totalSales: number;
  conversionRate: number;
  avgScore: number;
  totalSaleValue: number;
  totalEntryValue: number;
  monthlyGoal: number;
}

export default function SquadView() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, isLeader, loading: roleLoading } = useUserRole();
  
  const [squadMembers, setSquadMembers] = useState<SquadMember[]>([]);
  const [selectedCloserId, setSelectedCloserId] = useState<string>('');
  const [selectedCloser, setSelectedCloser] = useState<SquadMember | null>(null);
  const [closerStats, setCloserStats] = useState<CloserStats | null>(null);
  const [closerCalls, setCloserCalls] = useState<Call[]>([]);
  const [selectedCall, setSelectedCall] = useState<Call | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingCalls, setLoadingCalls] = useState(false);
  const [showGoalDialog, setShowGoalDialog] = useState(false);
  const [dateRange, setDateRange] = useState({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date())
  });
  const [reanalyzingCalls, setReanalyzingCalls] = useState(false);

  useEffect(() => {
    if (!authLoading && !roleLoading && user && (isAdmin || isLeader)) {
      fetchSquadMembers();
    }
  }, [user, authLoading, roleLoading, isAdmin, isLeader]);

  useEffect(() => {
    if (selectedCloserId) {
      const closer = squadMembers.find(m => m.user_id === selectedCloserId);
      setSelectedCloser(closer || null);
      fetchCloserData(selectedCloserId);
    }
  }, [selectedCloserId, dateRange]);

  const fetchSquadMembers = async () => {
    try {
      setLoading(true);
      
      // Fetch squads where user is a member (for leaders) or all squads (for admins)
      let squadIds: string[] = [];
      
      if (isAdmin) {
        const { data: allSquads } = await supabase
          .from('squads')
          .select('id');
        squadIds = allSquads?.map(s => s.id) || [];
      } else {
        const { data: mySquads } = await supabase
          .from('squad_members')
          .select('squad_id')
          .eq('user_id', user!.id);
        squadIds = mySquads?.map(s => s.squad_id) || [];
      }

      if (squadIds.length === 0) {
        setSquadMembers([]);
        return;
      }

      // Fetch all members from those squads
      const { data: members, error } = await supabase
        .from('squad_members')
        .select('id, user_id, squad_id')
        .in('squad_id', squadIds);

      if (error) throw error;

      // Fetch profiles and roles for those members in parallel
      const userIds = [...new Set(members?.map(m => m.user_id) || [])];
      
      const [{ data: profiles }, { data: roles }] = await Promise.all([
        supabase.from('profiles').select('user_id, full_name').in('user_id', userIds),
        supabase.from('user_roles').select('user_id, role').in('user_id', userIds)
      ]);

      const enrichedMembers: SquadMember[] = userIds
        .filter(uid => uid !== user!.id) // Exclude self
        .map(uid => {
          const profile = profiles?.find(p => p.user_id === uid);
          const role = roles?.find(r => r.user_id === uid);
          const member = members?.find(m => m.user_id === uid);
          return {
            id: member?.id || '',
            user_id: uid,
            full_name: profile?.full_name || 'Usuário',
            role: role?.role || 'closer'
          };
        })
        .filter(m => m.role === 'closer'); // Only show closers

      setSquadMembers(enrichedMembers);
    } catch (error) {
      console.error('Error fetching squad members:', error);
      toast.error('Erro ao carregar membros do time');
    } finally {
      setLoading(false);
    }
  };

  const fetchCloserData = async (closerId: string) => {
    try {
      setLoadingCalls(true);
      
      const fromDate = format(dateRange.from, 'yyyy-MM-dd');
      const toDate = format(dateRange.to, 'yyyy-MM-dd');

      const currentMonth = new Date().getMonth() + 1;
      const currentYear = new Date().getFullYear();

      // Fetch calls, goal, and repitch clients in parallel
      const [callsResult, goalResult, repitchResult] = await Promise.all([
        supabase
          .from('calls')
          .select('id, closer_id, client_id, client_name, call_date, call_time, duration_minutes, status, score, product, sale_value, entry_value, main_errors, main_wins, loss_point, niche, main_pain, main_difficulty, ai_summary, call_conclusion, technical_analysis, merged_with_call_id, created_at, updated_at, analyzed_at, notes, observation, company_name, consciousness_level, decision_reason, lead_classification, closer_classification, has_partner, next_contact_date, analysis_quality_score, analysis_metadata, deleted_at, deleted_by, source_file_id, google_doc_id, content_hash')
          .eq('closer_id', closerId)
          .gte('call_date', fromDate)
          .lte('call_date', toDate)
          .order('call_date', { ascending: false }),
        supabase
          .from('monthly_goals')
          .select('goal_value')
          .eq('closer_id', closerId)
          .eq('month', currentMonth)
          .eq('year', currentYear)
          .maybeSingle(),
        supabase
          .from('clients')
          .select('id')
          .eq('closer_id', closerId)
          .eq('status', 'repitch')
      ]);

      const { data: calls, error: callsError } = callsResult;
      if (callsError) throw callsError;
      const { data: goalData } = goalResult;
      const { data: repitchClients } = repitchResult;
      
      const repitchClientIds = new Set(repitchClients?.map(c => c.id) || []);

      // Calculate stats
      const totalCalls = calls?.length || 0;
      const sales = calls?.filter(c => c.status === 'vendido') || [];
      const totalSales = sales.length;
      const conversionRate = totalCalls > 0 ? (totalSales / totalCalls) * 100 : 0;
      
      // Filter out calls from clients in "repitch" status for average
      const callsForAverage = calls?.filter(c => 
        c.score && 
        (!c.client_id || !repitchClientIds.has(c.client_id))
      ) || [];
      const avgScore = callsForAverage.length > 0 
        ? callsForAverage.reduce((a, c) => a + (c.score || 0), 0) / callsForAverage.length 
        : 0;
      
      const totalSaleValue = sales.reduce((acc, c) => acc + (Number(c.sale_value) || 0), 0);
      const totalEntryValue = sales.reduce((acc, c) => acc + (Number(c.entry_value) || 0), 0);

      setCloserStats({
        totalCalls,
        totalSales,
        conversionRate,
        avgScore,
        totalSaleValue,
        totalEntryValue,
        monthlyGoal: goalData?.goal_value || 0
      });

      setCloserCalls((calls as unknown as Call[]) || []);
    } catch (error) {
      console.error('Error fetching closer data:', error);
      toast.error('Erro ao carregar dados do closer');
    } finally {
      setLoadingCalls(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
      pendente: { label: 'Pendente', variant: 'secondary' },
      em_andamento: { label: 'Em Andamento', variant: 'outline' },
      follow_up: { label: 'Follow-up', variant: 'outline' },
      proposta_enviada: { label: 'Proposta', variant: 'default' },
      vendido: { label: 'Vendido', variant: 'default' },
      perdido: { label: 'Perdido', variant: 'destructive' }
    };
    
    const config = statusMap[status] || { label: status, variant: 'secondary' as const };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  // Verifica se uma call tem mapeamentos incompletos
  const isCallIncomplete = (call: Call): boolean => {
    const techAnalysis = call.technical_analysis as TechnicalAnalysis | undefined;
    if (!techAnalysis) return false;
    
    const analiseEtapas = techAnalysis.analise_por_etapa as Record<string, unknown> | undefined;
    
    // Verifica mapeamento_empresa
    const mapeamentoEmpresa = analiseEtapas?.mapeamento_empresa || techAnalysis?.mapeamento_empresa || techAnalysis?.mapeamento_negocio;
    const empresaVazia = !mapeamentoEmpresa || (typeof mapeamentoEmpresa === 'object' && Object.keys(mapeamentoEmpresa as object).length === 0);
    
    // Verifica mapeamento_problema
    const mapeamentoProblema = analiseEtapas?.mapeamento_problema || techAnalysis?.mapeamento_problema || techAnalysis?.mapeamento_problemas;
    const problemaVazio = !mapeamentoProblema || (typeof mapeamentoProblema === 'object' && Object.keys(mapeamentoProblema as object).length === 0);
    
    return empresaVazia || problemaVazio;
  };

  // Conta calls incompletas
  const incompleteCallsCount = closerCalls.filter(isCallIncomplete).length;

  // Reanalisar calls com mapeamentos vazios
  const handleReanalyzeIncomplete = async () => {
    const callsToReanalyze = closerCalls.filter(isCallIncomplete);
    
    if (callsToReanalyze.length === 0) {
      toast.info('Nenhuma call com análise incompleta encontrada');
      return;
    }

    setReanalyzingCalls(true);
    toast.info(`Iniciando reanálise de ${callsToReanalyze.length} calls...`);

    let successCount = 0;
    let errorCount = 0;

    for (const call of callsToReanalyze) {
      try {
        const { error } = await supabase.functions.invoke('reanalyze-call', {
          body: { callId: call.id }
        });

        if (error) {
          console.error(`Erro ao reanalisar call ${call.id}:`, error);
          errorCount++;
        } else {
          successCount++;
        }
      } catch (err) {
        console.error(`Erro ao reanalisar call ${call.id}:`, err);
        errorCount++;
      }
    }

    setReanalyzingCalls(false);

    if (errorCount === 0) {
      toast.success(`${successCount} calls reanalisadas com sucesso!`);
    } else {
      toast.warning(`${successCount} calls reanalisadas, ${errorCount} com erro`);
    }

    // Recarregar dados
    if (selectedCloserId) {
      fetchCloserData(selectedCloserId);
    }
  };

  if (authLoading || roleLoading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      </MainLayout>
    );
  }

  if (!isAdmin && !isLeader) {
    navigate('/');
    return null;
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-display font-bold text-foreground">
              Visualizar Time
            </h1>
            <p className="text-muted-foreground">
              Acompanhe o desempenho dos closers do seu time
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            <DateRangePicker
              dateRange={dateRange}
              onDateRangeChange={(range) => {
                if (range?.from && range?.to) {
                  setDateRange({ from: range.from, to: range.to });
                }
              }}
            />
          </div>
        </div>

        {/* Closer Selector */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Users className="w-5 h-5" />
              Selecionar Closer
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-10 w-full max-w-md" />
            ) : squadMembers.length === 0 ? (
              <p className="text-muted-foreground">Nenhum closer encontrado no seu time.</p>
            ) : (
              <Select value={selectedCloserId} onValueChange={setSelectedCloserId}>
                <SelectTrigger className="w-full max-w-md">
                  <SelectValue placeholder="Selecione um closer para visualizar" />
                </SelectTrigger>
                <SelectContent>
                  {squadMembers.map((member) => (
                    <SelectItem key={member.user_id} value={member.user_id}>
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center">
                          <span className="text-xs font-medium text-primary">
                            {member.full_name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <span>{member.full_name}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </CardContent>
        </Card>

        {/* Closer Dashboard */}
        {selectedCloser && closerStats && (
          <>
            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              <StatsCard
                title="Total de Calls"
                value={closerStats.totalCalls}
                icon={Phone}
              />
              <StatsCard
                title="Vendas"
                value={closerStats.totalSales}
                icon={TrendingUp}
              />
              <StatsCard
                title="Conversão"
                value={`${closerStats.conversionRate.toFixed(1)}%`}
                icon={Target}
              />
              <StatsCard
                title="Nota Média"
                value={closerStats.avgScore.toFixed(1)}
                icon={Star}
              />
              <StatsCard
                title="Valor Total"
                value={formatCurrency(closerStats.totalSaleValue)}
                icon={DollarSign}
              />
              <StatsCard
                title="Valor Entrada"
                value={formatCurrency(closerStats.totalEntryValue)}
                icon={DollarSign}
              />
            </div>

            {/* Monthly Goal */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Meta Mensal</p>
                    <p className="text-2xl font-bold">
                      {closerStats.monthlyGoal > 0 
                        ? formatCurrency(closerStats.monthlyGoal)
                        : 'Não definida'}
                    </p>
                    {closerStats.monthlyGoal > 0 && (
                      <p className="text-sm text-muted-foreground mt-1">
                        Progresso: {formatCurrency(closerStats.totalSaleValue)} ({((closerStats.totalSaleValue / closerStats.monthlyGoal) * 100).toFixed(1)}%)
                      </p>
                    )}
                  </div>
                  <Button onClick={() => setShowGoalDialog(true)}>
                    <Target className="w-4 h-4 mr-2" />
                    Definir Meta
                  </Button>
                </div>
                {closerStats.monthlyGoal > 0 && (
                  <div className="mt-4 h-2 bg-muted rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-primary transition-all"
                      style={{ 
                        width: `${Math.min((closerStats.totalSaleValue / closerStats.monthlyGoal) * 100, 100)}%` 
                      }}
                    />
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Calls List */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Phone className="w-5 h-5" />
                  Calls de {selectedCloser.full_name}
                  {incompleteCallsCount > 0 && (
                    <Badge variant="destructive" className="ml-2">
                      {incompleteCallsCount} incompleta{incompleteCallsCount > 1 ? 's' : ''}
                    </Badge>
                  )}
                </CardTitle>
                {incompleteCallsCount > 0 && (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={handleReanalyzeIncomplete}
                    disabled={reanalyzingCalls}
                  >
                    {reanalyzingCalls ? (
                      <>
                        <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                        Reanalisando...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Reanalisar Incompletas
                      </>
                    )}
                  </Button>
                )}
              </CardHeader>
              <CardContent>
                {loadingCalls ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map(i => (
                      <Skeleton key={i} className="h-16 w-full" />
                    ))}
                  </div>
                ) : closerCalls.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">
                    Nenhuma call encontrada no período selecionado.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {closerCalls.map((call) => (
                      <div 
                        key={call.id}
                        className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                        onClick={() => setSelectedCall(call)}
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                            <Phone className="w-5 h-5 text-primary" />
                          </div>
                          <div>
                            <p className="font-medium">{call.client_name}</p>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Calendar className="w-3 h-3" />
                              {format(new Date(call.call_date), "dd/MM/yyyy", { locale: ptBR })}
                              {call.score && (
                                <span className="flex items-center gap-1">
                                  <Star className="w-3 h-3" />
                                  {call.score}/10
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          {isCallIncomplete(call) && (
                            <Badge variant="outline" className="text-amber-600 border-amber-300 bg-amber-50">
                              <AlertTriangle className="w-3 h-3 mr-1" />
                              Incompleta
                            </Badge>
                          )}
                          {getStatusBadge(call.status)}
                          <CallCardMenu
                            call={call}
                            canDelete={true}
                            targetCloserId={selectedCloserId}
                            onViewDetails={() => setSelectedCall(call)}
                            onCallUpdated={() => {
                              if (selectedCloserId) {
                                fetchCloserData(selectedCloserId);
                              }
                            }}
                          />
                          <ChevronRight className="w-4 h-4 text-muted-foreground" />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}

        {/* Call Detail Dialog */}
        <CallDetailDialog
          call={selectedCall}
          open={!!selectedCall}
          onOpenChange={() => setSelectedCall(null)}
          onCallUpdated={() => {
            setSelectedCall(null);
            if (selectedCloserId) {
              fetchCloserData(selectedCloserId);
            }
          }}
          canDelete={true}
          targetCloserId={selectedCloserId}
        />

        {/* Set Goal Dialog */}
        <SetMonthlyGoalDialog
          open={showGoalDialog}
          onOpenChange={setShowGoalDialog}
          onSuccess={() => {
            if (selectedCloserId) {
              fetchCloserData(selectedCloserId);
            }
          }}
          closers={selectedCloser ? [{
            id: '',
            user_id: selectedCloser.user_id,
            full_name: selectedCloser.full_name
          }] : []}
        />
      </div>
    </MainLayout>
  );
}
