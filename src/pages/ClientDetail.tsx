import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import MainLayout from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import ClientEditDialog from '@/components/clients/ClientEditDialog';
import IntensiveParticipationDialog from '@/components/clients/IntensiveParticipationDialog';
import MentoriaExtraDialog from '@/components/clients/MentoriaExtraDialog';
import ClientIndicationsDialog from '@/components/clients/ClientIndicationsDialog';
import IndicationSourceDialog from '@/components/clients/IndicationSourceDialog';
import SaleFormDialog from '@/components/clients/SaleFormDialog';
import { useClientActivities, useClientIndications } from '@/hooks/useClientActivities';
import { 
  ArrowLeft, 
  Building2, 
  Mail, 
  Phone, 
  DollarSign, 
  Target, 
  Briefcase, 
  Users,
  Calendar,
  Star,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  BadgeCheck,
  Trash2,
  Merge,
  Zap,
  BookOpen,
  Link2,
  ChevronDown,
  ChevronUp,
  MessageSquare,
  Copy,
  Dumbbell,
  FileText,
  Quote
} from 'lucide-react';
import { MergeCallDialog } from '@/components/calls/MergeCallDialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Client, Call, CallStatus, StageAnalysis, ChecklistItem, PlanoAcaoDireto, ErroDetalhado, AcertoDetalhado, FraseMelhor, SeedsProvaSocial } from '@/types';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const statusConfig: Record<CallStatus, { label: string; className: string }> = {
  pendente: { label: 'Pendente', className: 'bg-secondary text-secondary-foreground' },
  em_andamento: { label: 'Em andamento', className: 'bg-info text-info-foreground' },
  follow_up: { label: 'Follow-up', className: 'bg-warning text-warning-foreground' },
  proposta_enviada: { label: 'Proposta enviada', className: 'bg-info text-info-foreground' },
  vendido: { label: 'Vendido', className: 'bg-success text-success-foreground' },
  perdido: { label: 'Perdido', className: 'bg-destructive text-destructive-foreground' },
};

// Nova ordem do Framework Julia Ottoni (atualizada para alinhar com o prompt)
const stageOrder = [
  'conexao',
  'abertura',
  'mapeamento_empresa',
  'mapeamento_problema',
  'consultoria',
  'problematizacao',
  'solucao_imaginada',
  'transicao',
  'pitch',
  'perguntas_compromisso',
  'fechamento',
  'objecoes_negociacao'
];

const stageLabels: Record<string, string> = {
  conexao: 'Conexão Estratégica',
  abertura: 'Abertura',
  mapeamento_empresa: 'Mapeamento da Empresa',
  mapeamento_problema: 'Mapeamento do Problema / Dor Profunda',
  consultoria: 'Consultoria Estratégica',
  problematizacao: 'Problematização',
  solucao_imaginada: 'Solução Imaginada',
  transicao: 'Transição',
  pitch: 'Pitch',
  perguntas_compromisso: 'Perguntas de Compromisso',
  fechamento: 'Fechamento Estratégico',
  objecoes_negociacao: 'Quebra de Objeções / Negociação',
  // Legado (para compatibilidade)
  mapeamento_negocio: 'Mapeamento do Negócio',
  mapeamento_problemas: 'Mapeamento do Problema',
  contorno_objecoes: 'Contorno de Objeções',
};

const checklistLabels: Record<string, string> = {
  abertura_ancoragem_script: 'Abertura / Ancoragem / Script',
  profundidade_nao_fugir_assunto: 'Profundidade (Não Fugir do Assunto)',
  emocao_e_tensao: 'Emoção e Tensão',
  prova_social_seeds_durante_perguntas: 'Prova Social / Seeds Durante Perguntas',
  objecao_real_vs_declarada: 'Objeção Real vs Declarada',
  negociacao_maximizar_receita: 'Negociação (Maximizar Receita)',
};

// Helper para converter array para string
const getStringValue = (value: unknown): string | null => {
  if (!value) return null;
  if (Array.isArray(value)) return value.join(' | ');
  return String(value);
};

// Helper para processar frase_melhor (pode ser string, array, ou objeto)
const getFraseMelhor = (frase: FraseMelhor | string | string[] | undefined): FraseMelhor | null => {
  if (!frase) return null;
  if (typeof frase === 'string') return { antes: frase, depois: '' };
  if (Array.isArray(frase)) return { antes: frase[0] || '', depois: frase[1] || '' };
  if (typeof frase === 'object' && ('antes' in frase || 'depois' in frase)) {
    return frase as FraseMelhor;
  }
  return null;
};

// Helper para processar seeds_prova_social
const getSeedsProvaSocial = (seeds: SeedsProvaSocial | string[] | undefined): SeedsProvaSocial | null => {
  if (!seeds) return null;
  if (Array.isArray(seeds)) return { usadas: seeds, faltaram: [] };
  if (typeof seeds === 'object' && ('usadas' in seeds || 'faltaram' in seeds)) {
    return seeds as SeedsProvaSocial;
  }
  return null;
};

// Copiar texto para clipboard
const copyToClipboard = (text: string) => {
  navigator.clipboard.writeText(text);
  toast.success('Copiado para a área de transferência!');
};

export default function ClientDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [client, setClient] = useState<Client | null>(null);
  const [calls, setCalls] = useState<Call[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCall, setSelectedCall] = useState<Call | null>(null);
  const [saleDialogOpen, setSaleDialogOpen] = useState(false);
  const [intensiveDialogOpen, setIntensiveDialogOpen] = useState(false);
  const [mentoriaDialogOpen, setMentoriaDialogOpen] = useState(false);
  const [indicationsDialogOpen, setIndicationsDialogOpen] = useState(false);
  const [indicationSourceDialogOpen, setIndicationSourceDialogOpen] = useState(false);
  const [expandedStages, setExpandedStages] = useState<Record<string, boolean>>({});

  const toggleStageExpanded = (key: string) => {
    setExpandedStages(prev => ({ ...prev, [key]: !prev[key] }));
  };

  useEffect(() => {
    if (user && id) {
      fetchClientData();
    }
  }, [user, id]);

  const fetchClientData = async () => {
    if (!user || !id) return;

    try {
      // Fetch client
      const { data: clientData, error: clientError } = await supabase
        .from('clients')
        .select('*')
        .eq('id', id)
        .eq('closer_id', user.id)
        .single();

      if (clientError) throw clientError;
      setClient(clientData as Client);

      // Fetch calls for this client
      const { data: callsData, error: callsError } = await supabase
        .from('calls')
        .select('*')
        .eq('client_id', id)
        .order('call_date', { ascending: false });

      if (callsError) throw callsError;
      const typedCalls = (callsData || []) as Call[];
      setCalls(typedCalls);
      
      // Select the most recent call with analysis
      const callWithAnalysis = typedCalls.find(c => c.technical_analysis);
      if (callWithAnalysis) {
        setSelectedCall(callWithAnalysis);
      } else if (typedCalls.length > 0) {
        setSelectedCall(typedCalls[0]);
      }
    } catch (error) {
      console.error('Error fetching client data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number | null) => {
    if (!value) return '-';
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const getScoreColor = (score: number) => {
    if (score >= 8) return 'text-success';
    if (score >= 6) return 'text-warning';
    return 'text-destructive';
  };

  const getChecklistStatusBadge = (status: string | undefined) => {
    if (status === 'ok') return <Badge className="bg-success text-success-foreground">OK</Badge>;
    if (status === 'parcial') return <Badge className="bg-warning text-warning-foreground">Parcial</Badge>;
    if (status === 'falhou') return <Badge className="bg-destructive text-destructive-foreground">Falhou</Badge>;
    return <Badge variant="outline">N/A</Badge>;
  };

  const handleSaleCheckbox = () => {
    setSaleDialogOpen(true);
  };

  const handleDeleteClient = async () => {
    if (!client || !user) return;

    try {
      // Delete associated calls first
      await supabase
        .from('calls')
        .delete()
        .eq('client_id', client.id);

      // Delete associated notes
      await supabase
        .from('client_notes')
        .delete()
        .eq('client_id', client.id);

      // Delete the client
      const { error } = await supabase
        .from('clients')
        .delete()
        .eq('id', client.id)
        .eq('closer_id', user.id);

      if (error) throw error;

      navigate('/clients');
    } catch (error) {
      console.error('Error deleting client:', error);
    }
  };

  if (loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center min-h-[50vh]">
          <div className="text-muted-foreground">Carregando...</div>
        </div>
      </MainLayout>
    );
  }

  if (!client) {
    return (
      <MainLayout>
        <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
          <p className="text-muted-foreground">Cliente não encontrado</p>
          <Button onClick={() => navigate('/clients')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar para CRM Calls
          </Button>
        </div>
      </MainLayout>
    );
  }

  // Extrair dados da análise técnica
  const techAnalysis = selectedCall?.technical_analysis as Record<string, unknown> | undefined;
  const analiseEtapas = techAnalysis?.analise_por_etapa as Record<string, StageAnalysis> | undefined;
  const checklistErros = techAnalysis?.checklist_erros_recorrentes as Record<string, ChecklistItem> | undefined;
  const planoAcao = techAnalysis?.plano_de_acao_direto as PlanoAcaoDireto | undefined;
  const detailedErrors = techAnalysis?.detailed_errors as ErroDetalhado[] | undefined;
  const detailedWins = techAnalysis?.detailed_wins as AcertoDetalhado[] | undefined;

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/clients')}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-3xl font-display font-bold">{client.name}</h1>
                {client.is_sold && (
                  <Badge className="bg-success text-success-foreground">
                    <BadgeCheck className="w-3 h-3 mr-1" />
                    Vendido
                  </Badge>
                )}
              </div>
              {client.company && (
                <p className="text-muted-foreground flex items-center gap-1">
                  <Building2 className="w-4 h-4" />
                  {client.company}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Checkbox 
                id="sold" 
                checked={client.is_sold || false}
                onCheckedChange={handleSaleCheckbox}
              />
              <label 
                htmlFor="sold" 
                className="text-sm font-medium cursor-pointer"
              >
                Venda Realizada
              </label>
            </div>
            <ClientEditDialog client={client} onClientUpdated={fetchClientData} />
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="icon">
                  <Trash2 className="w-4 h-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Excluir cliente?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Esta ação não pode ser desfeita. Isso excluirá permanentemente o cliente 
                    <strong> {client.name}</strong> e todas as calls e notas associadas.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDeleteClient} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                    Excluir
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>

        {/* Action Buttons Row */}
        <div className="flex flex-wrap gap-2">
          <Button 
            variant="outline" 
            onClick={() => setIntensiveDialogOpen(true)}
            className="gap-2"
          >
            <Zap className="w-4 h-4 text-warning" />
            Intensivo
          </Button>
          <Button 
            variant="outline" 
            onClick={() => setIndicationsDialogOpen(true)}
            className="gap-2"
          >
            <Users className="w-4 h-4 text-primary" />
            Indicações
          </Button>
          <Button 
            variant="outline" 
            onClick={() => setMentoriaDialogOpen(true)}
            className="gap-2"
          >
            <BookOpen className="w-4 h-4 text-primary" />
            Mentoria Extra
          </Button>
          <Button 
            variant="outline" 
            onClick={() => setIndicationSourceDialogOpen(true)}
            className={cn("gap-2", client.is_from_indication && "border-success text-success")}
          >
            <Link2 className="w-4 h-4" />
            {client.is_from_indication ? 'Veio de Indicação ✓' : 'Origem Indicação'}
          </Button>
        </div>
        {client.is_sold && (
          <Card className="border-success/50 bg-success/5">
            <CardContent className="py-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-6">
                  <div>
                    <p className="text-xs text-muted-foreground">Valor da Venda</p>
                    <p className="text-lg font-bold text-success">
                      {formatCurrency(client.sale_value)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Entrada</p>
                    <p className="text-lg font-semibold">
                      {formatCurrency(client.entry_value)}
                    </p>
                  </div>
                  {client.contract_validity && (
                    <div>
                      <p className="text-xs text-muted-foreground">Vigência</p>
                      <p className="text-sm font-medium">{client.contract_validity}</p>
                    </div>
                  )}
                  {client.sold_at && (
                    <div>
                      <p className="text-xs text-muted-foreground">Data da Venda</p>
                      <p className="text-sm font-medium">
                        {format(new Date(client.sold_at), "dd/MM/yyyy", { locale: ptBR })}
                      </p>
                    </div>
                  )}
                </div>
                <Button variant="outline" size="sm" onClick={() => setSaleDialogOpen(true)}>
                  Editar Venda
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Client Info Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Contact Info */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Contato</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Users className="w-4 h-4 flex-shrink-0" />
                <span>{client.name || <span className="text-muted-foreground/50 italic">Nome não informado</span>}</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Phone className="w-4 h-4 flex-shrink-0" />
                <span>{client.phone || <span className="text-muted-foreground/50 italic">Telefone não informado</span>}</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Mail className="w-4 h-4 flex-shrink-0" />
                <span>{client.email || <span className="text-muted-foreground/50 italic">E-mail não informado</span>}</span>
              </div>
            </CardContent>
          </Card>

          {/* Business Info */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Negócio</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Briefcase className="w-4 h-4 flex-shrink-0" />
                <span>{client.niche || <span className="text-muted-foreground/50 italic">Nicho não informado</span>}</span>
              </div>
              <div className="flex items-center gap-2 text-success font-medium">
                <DollarSign className="w-4 h-4 flex-shrink-0" />
                <span>{client.revenue ? formatCurrency(client.revenue) : <span className="text-muted-foreground/50 italic font-normal">Faturamento não informado</span>}</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Users className="w-4 h-4 flex-shrink-0" />
                <span>{client.has_partner !== null ? (client.has_partner ? 'Com sócio' : 'Sem sócio') : <span className="text-muted-foreground/50 italic">Sócio não informado</span>}</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Target className="w-4 h-4 flex-shrink-0" />
                <span>{client.funnel_source || <span className="text-muted-foreground/50 italic">Funil não informado</span>}</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Users className="w-4 h-4 flex-shrink-0" />
                <span>{client.sdr_name ? `SDR: ${client.sdr_name}` : <span className="text-muted-foreground/50 italic">SDR não informado</span>}</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Briefcase className="w-4 h-4 flex-shrink-0" />
                <span>{client.product_offered ? `Produto: ${client.product_offered}` : <span className="text-muted-foreground/50 italic">Produto não informado</span>}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Follow-up Date */}
        {client.followup_date && (
          <Card className="border-warning/50 bg-warning/5">
            <CardContent className="py-3">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-warning" />
                <span className="text-sm font-medium">Follow-up agendado para: </span>
                <span className="text-sm text-warning font-semibold">
                  {format(new Date(client.followup_date), "dd/MM/yyyy", { locale: ptBR })}
                </span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Pain Points Card */}
        {(client.main_pain || client.main_difficulty) && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Perfil do Cliente</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              {client.main_pain && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Dor principal:</p>
                  <p className="text-sm">{client.main_pain}</p>
                </div>
              )}
              {client.main_difficulty && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Maior dificuldade:</p>
                  <p className="text-sm">{client.main_difficulty}</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Tabs */}
        <Tabs defaultValue="calls" className="w-full">
          <TabsList>
            <TabsTrigger value="calls">Histórico de Calls ({calls.length})</TabsTrigger>
            <TabsTrigger value="analysis" disabled={!selectedCall?.technical_analysis}>
              Análise Técnica
            </TabsTrigger>
            
          </TabsList>

          <TabsContent value="calls" className="mt-4">
            {calls.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center">
                  <p className="text-muted-foreground">Nenhuma call registrada</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {calls.map((call) => {
                  const statusInfo = statusConfig[call.status];
                  return (
                    <Card 
                      key={call.id} 
                      className={cn(
                        "cursor-pointer transition-all hover:shadow-md",
                        selectedCall?.id === call.id && "border-primary"
                      )}
                      onClick={() => setSelectedCall(call)}
                    >
                      <CardContent className="py-4">
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <Calendar className="w-4 h-4" />
                              <span>{format(new Date(call.call_date), "dd/MM/yyyy", { locale: ptBR })}</span>
                            </div>
                            {call.product && (
                              <Badge variant="outline">{call.product}</Badge>
                            )}
                            <Badge className={cn('font-medium', statusInfo.className)}>
                              {statusInfo.label}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-4">
                            {call.score !== null && (
                              <div className="flex items-center gap-1">
                                <Star className="w-4 h-4 text-warning" />
                                <span className={cn("font-medium", getScoreColor(call.score))}>
                                  {call.score}/10
                                </span>
                              </div>
                            )}
                            {call.sale_value && (
                              <span className="text-success font-medium">
                                {formatCurrency(call.sale_value)}
                              </span>
                            )}
                            <div onClick={(e) => e.stopPropagation()}>
                              <MergeCallDialog 
                                currentCall={call} 
                                onMergeComplete={fetchClientData} 
                              />
                            </div>
                          </div>
                        </div>
                        {call.ai_summary && (
                          <p className="mt-2 text-sm text-muted-foreground line-clamp-2">
                            {call.ai_summary}
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="analysis" className="mt-4">
            {selectedCall?.technical_analysis && (
              <div className="space-y-6">
                {/* Overview - Nota Geral */}
                <Card className="max-w-xs">
                  <CardContent className="pt-6 text-center">
                    <div className={cn("text-5xl font-bold", getScoreColor(selectedCall.score || 0))}>
                      {selectedCall.score || 0}
                    </div>
                    <p className="text-sm text-muted-foreground mt-2">Nota Geral</p>
                  </CardContent>
                </Card>

                {/* Plano de Ação Direto */}
                {planoAcao && (
                  <Card className="border-primary/50 bg-primary/5">
                    <CardHeader>
                      <CardTitle className="text-base flex items-center gap-2">
                        <Zap className="w-5 h-5 text-primary" />
                        Plano de Ação Direto
                      </CardTitle>
                      <CardDescription>O que fazer para melhorar na próxima call</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {/* Ajuste Número 1 */}
                      {planoAcao.ajuste_numero_1 && (
                        <div className="bg-background rounded-lg p-4 border">
                          <h4 className="font-semibold text-primary mb-2 flex items-center gap-2">
                            <Target className="w-4 h-4" />
                            Ajuste Número 1
                          </h4>
                          {planoAcao.ajuste_numero_1.diagnostico && (
                            <p className="text-sm mb-2"><strong>Diagnóstico:</strong> {planoAcao.ajuste_numero_1.diagnostico}</p>
                          )}
                          {planoAcao.ajuste_numero_1.o_que_fazer_na_proxima_call && planoAcao.ajuste_numero_1.o_que_fazer_na_proxima_call.length > 0 && (
                            <div className="mb-2">
                              <p className="text-sm font-medium mb-1">O que fazer na próxima call:</p>
                              <ul className="text-sm space-y-1 pl-4">
                                {planoAcao.ajuste_numero_1.o_que_fazer_na_proxima_call.map((item, i) => (
                                  <li key={i} className="list-disc">{item}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {planoAcao.ajuste_numero_1.script_30_segundos && (
                            <div className="bg-muted/50 rounded p-3 mt-2">
                              <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                                <FileText className="w-3 h-3" />
                                Script de 30 segundos:
                              </p>
                              <p className="text-sm italic">"{planoAcao.ajuste_numero_1.script_30_segundos}"</p>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="mt-2"
                                onClick={() => copyToClipboard(planoAcao.ajuste_numero_1?.script_30_segundos || '')}
                              >
                                <Copy className="w-3 h-3 mr-1" /> Copiar
                              </Button>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Treino Recomendado */}
                      {planoAcao.treino_recomendado && planoAcao.treino_recomendado.length > 0 && (
                        <div className="bg-background rounded-lg p-4 border">
                          <h4 className="font-semibold text-primary mb-3 flex items-center gap-2">
                            <Dumbbell className="w-4 h-4" />
                            Treino Recomendado
                          </h4>
                          <div className="space-y-3">
                            {planoAcao.treino_recomendado.map((treino, i) => (
                              <div key={i} className="border-l-2 border-primary/30 pl-3">
                                <p className="font-medium text-sm">{treino.habilidade}</p>
                                {treino.como_treinar && (
                                  <p className="text-xs text-muted-foreground">{treino.como_treinar}</p>
                                )}
                                {treino.meta_objetiva && (
                                  <p className="text-xs text-success mt-1">Meta: {treino.meta_objetiva}</p>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Próxima Ação com Lead */}
                      {planoAcao.proxima_acao_com_lead && (
                        <div className="bg-background rounded-lg p-4 border">
                          <h4 className="font-semibold text-primary mb-2 flex items-center gap-2">
                            <MessageSquare className="w-4 h-4" />
                            Próxima Ação com Lead
                          </h4>
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-sm">Status:</span>
                            <Badge variant="outline" className={cn(
                              planoAcao.proxima_acao_com_lead.status === 'fechado' && 'bg-success/20 text-success',
                              planoAcao.proxima_acao_com_lead.status === 'follow_up' && 'bg-warning/20 text-warning',
                              planoAcao.proxima_acao_com_lead.status === 'desqualificado' && 'bg-destructive/20 text-destructive'
                            )}>
                              {planoAcao.proxima_acao_com_lead.status || 'Não informado'}
                            </Badge>
                          </div>
                          {planoAcao.proxima_acao_com_lead.passo && (
                            <p className="text-sm mb-2"><strong>Próximo passo:</strong> {planoAcao.proxima_acao_com_lead.passo}</p>
                          )}
                          {planoAcao.proxima_acao_com_lead.mensagem_sugerida_whats && (
                            <div className="bg-success/10 rounded p-3 mt-2">
                              <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                                <MessageSquare className="w-3 h-3" />
                                Mensagem sugerida para WhatsApp:
                              </p>
                              <p className="text-sm">"{planoAcao.proxima_acao_com_lead.mensagem_sugerida_whats}"</p>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="mt-2"
                                onClick={() => copyToClipboard(planoAcao.proxima_acao_com_lead?.mensagem_sugerida_whats || '')}
                              >
                                <Copy className="w-3 h-3 mr-1" /> Copiar
                              </Button>
                            </div>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* Checklist de Erros Recorrentes */}
                {checklistErros && Object.keys(checklistErros).length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-primary" />
                        Checklist de Erros Recorrentes
                      </CardTitle>
                      <CardDescription>Validação dos principais pontos de atenção</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {Object.entries(checklistErros).map(([key, check]) => {
                          const checkItem = check as ChecklistItem;
                          return (
                            <div key={key} className="border rounded-lg p-3">
                              <div className="flex items-center justify-between mb-2">
                                <span className="font-medium text-sm">{checklistLabels[key] || key}</span>
                                {getChecklistStatusBadge(checkItem.status)}
                              </div>
                              {checkItem.evidencias && checkItem.evidencias.length > 0 && (
                                <div className="mb-2">
                                  <p className="text-xs text-muted-foreground">Evidências:</p>
                                  <ul className="text-xs space-y-1 pl-3">
                                    {checkItem.evidencias.map((ev, i) => (
                                      <li key={i} className="list-disc italic text-muted-foreground">"{ev}"</li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                              {checkItem.correcao && (
                                <div className="bg-muted/50 rounded p-2 mt-2">
                                  <p className="text-xs text-primary"><strong>Correção:</strong> {checkItem.correcao}</p>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Maiores Acertos e Erros (Detalhado) */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Maiores Acertos */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-success" />
                        Maiores Acertos
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {detailedWins && detailedWins.length > 0 ? (
                        <div className="space-y-4">
                          {detailedWins.map((win, i) => (
                            <div key={i} className="border-l-2 border-success pl-3">
                              <p className="font-medium text-sm text-success">{win.acerto}</p>
                              {win.evidencia && (
                                <p className="text-xs text-muted-foreground italic mt-1">
                                  <Quote className="w-3 h-3 inline mr-1" />
                                  "{win.evidencia}"
                                </p>
                              )}
                              {win.porque_importa && (
                                <p className="text-xs mt-1"><strong>Porque importa:</strong> {win.porque_importa}</p>
                              )}
                              {win.como_repetir && (
                                <p className="text-xs text-success mt-1"><strong>Como repetir:</strong> {win.como_repetir}</p>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <ul className="space-y-2">
                          {selectedCall.main_wins?.map((win, i) => (
                            <li key={i} className="flex items-start gap-2 text-sm">
                              <TrendingUp className="w-4 h-4 text-success flex-shrink-0 mt-0.5" />
                              <span>{win}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </CardContent>
                  </Card>

                  {/* Maiores Erros */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-destructive" />
                        Maiores Erros
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {detailedErrors && detailedErrors.length > 0 ? (
                        <div className="space-y-4">
                          {detailedErrors.map((error, i) => (
                            <div key={i} className="border-l-2 border-destructive pl-3">
                              <p className="font-medium text-sm text-destructive">{error.erro}</p>
                              {error.evidencia && (
                                <p className="text-xs text-muted-foreground italic mt-1">
                                  <Quote className="w-3 h-3 inline mr-1" />
                                  "{error.evidencia}"
                                </p>
                              )}
                              {error.impacto && (
                                <p className="text-xs mt-1"><strong>Impacto:</strong> {error.impacto}</p>
                              )}
                              {error.como_corrigir && error.como_corrigir.length > 0 && (
                                <div className="mt-1">
                                  <p className="text-xs font-medium">Como corrigir:</p>
                                  <ul className="text-xs pl-3">
                                    {error.como_corrigir.map((corr, j) => (
                                      <li key={j} className="list-disc">{corr}</li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                              {error.frase_pronta && (
                                <div className="bg-muted/50 rounded p-2 mt-2 text-xs">
                                  <p><strong className="text-destructive">ANTES:</strong> "{error.frase_pronta.antes}"</p>
                                  <p><strong className="text-success">DEPOIS:</strong> "{error.frase_pronta.depois}"</p>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <ul className="space-y-2">
                          {selectedCall.main_errors?.map((error, i) => (
                            <li key={i} className="flex items-start gap-2 text-sm">
                              <XCircle className="w-4 h-4 text-destructive flex-shrink-0 mt-0.5" />
                              <span>{error}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </CardContent>
                  </Card>
                </div>

                {/* Loss Point */}
                {selectedCall.loss_point && (
                  <Card className="border-destructive/30">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base flex items-center gap-2 text-destructive">
                        <AlertTriangle className="w-4 h-4" />
                        Ponto de Perda da Venda
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm">{selectedCall.loss_point}</p>
                    </CardContent>
                  </Card>
                )}

                {/* Stage Analysis */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Análise por Etapa - Framework Julia Ottoni</CardTitle>
                    <CardDescription>Avaliação detalhada de cada etapa da call (clique para expandir)</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {stageOrder.map((key) => {
                        // Tenta acessar a etapa primeiro em analise_por_etapa, depois diretamente
                        const stage = analiseEtapas?.[key] || techAnalysis?.[key];
                        if (!stage || (typeof stage === 'object' && Object.keys(stage as object).length === 0)) return null;
                        
                        const stageData = stage as StageAnalysis;
                        const pontoForte = getStringValue(stageData.ponto_forte);
                        const pontoFraco = getStringValue(stageData.ponto_fraco);
                        const fraseMelhor = getFraseMelhor(stageData.frase_melhor);
                        const seedsProvaSocial = getSeedsProvaSocial(stageData.seeds_prova_social);
                        const isExpanded = expandedStages[key] || false;
                        
                        return (
                          <Collapsible key={key} open={isExpanded} onOpenChange={() => toggleStageExpanded(key)}>
                            <div className="border rounded-lg p-4">
                              <CollapsibleTrigger className="w-full">
                                <div className="flex items-center justify-between mb-2">
                                  <div className="flex items-center gap-2">
                                    <h4 className="font-medium">{stageLabels[key] || key}</h4>
                                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Badge 
                                      variant="outline" 
                                      className={cn(
                                        stageData.aconteceu === 'sim' && 'bg-success/20 text-success',
                                        stageData.aconteceu === 'parcial' && 'bg-warning/20 text-warning',
                                        stageData.aconteceu === 'nao' && 'bg-destructive/20 text-destructive'
                                      )}
                                    >
                                      {stageData.aconteceu === 'sim' ? 'Sim' : 
                                       stageData.aconteceu === 'parcial' ? 'Parcial' : 'Não'}
                                    </Badge>
                                    <span className={cn("font-bold", getScoreColor(stageData.nota || 0))}>
                                      {stageData.nota || 0}/10
                                    </span>
                                  </div>
                                </div>
                              </CollapsibleTrigger>
                              <Progress 
                                value={(stageData.nota || 0) * 10} 
                                className={cn(
                                  "h-2",
                                  (stageData.nota || 0) >= 8 && "[&>div]:bg-success",
                                  (stageData.nota || 0) >= 6 && (stageData.nota || 0) < 8 && "[&>div]:bg-warning",
                                  (stageData.nota || 0) < 6 && "[&>div]:bg-destructive"
                                )} 
                              />
                              
                              {/* Resumo básico sempre visível */}
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3 text-sm">
                                {pontoForte && (
                                  <div>
                                    <p className="text-xs text-muted-foreground mb-1">Ponto forte:</p>
                                    <p className="text-success">{pontoForte}</p>
                                  </div>
                                )}
                                {pontoFraco && (
                                  <div>
                                    <p className="text-xs text-muted-foreground mb-1">Ponto fraco:</p>
                                    <p className="text-destructive">{pontoFraco}</p>
                                  </div>
                                )}
                              </div>

                              {/* Detalhes expandidos */}
                              <CollapsibleContent>
                                <div className="mt-4 pt-4 border-t space-y-3">
                                  {/* Função cumprida */}
                                  {stageData.funcao_cumprida && (
                                    <div>
                                      <p className="text-xs text-muted-foreground mb-1">Função da etapa:</p>
                                      <p className="text-sm">{stageData.funcao_cumprida}</p>
                                    </div>
                                  )}

                                  {/* Evidências */}
                                  {stageData.evidencias && stageData.evidencias.length > 0 && (
                                    <div>
                                      <p className="text-xs text-muted-foreground mb-1">Evidências:</p>
                                      <ul className="text-sm space-y-1 pl-3">
                                        {stageData.evidencias.map((ev, i) => (
                                          <li key={i} className="list-disc text-muted-foreground italic">"{ev}"</li>
                                        ))}
                                      </ul>
                                    </div>
                                  )}

                                  {/* Erro de execução */}
                                  {stageData.erro_de_execucao && stageData.erro_de_execucao !== 'nao_informado' && (
                                    <div>
                                      <p className="text-xs text-muted-foreground mb-1">Erro de execução:</p>
                                      <p className="text-sm text-destructive">{stageData.erro_de_execucao}</p>
                                    </div>
                                  )}

                                  {/* Impacto no lead */}
                                  {stageData.impacto_no_lead && (
                                    <div>
                                      <p className="text-xs text-muted-foreground mb-1">Impacto no lead:</p>
                                      <p className="text-sm">{stageData.impacto_no_lead}</p>
                                    </div>
                                  )}

                                  {/* Como corrigir */}
                                  {stageData.como_corrigir && stageData.como_corrigir.length > 0 && (
                                    <div>
                                      <p className="text-xs text-muted-foreground mb-1">Como corrigir:</p>
                                      <ul className="text-sm space-y-1 pl-3">
                                        {stageData.como_corrigir.map((corr, i) => (
                                          <li key={i} className="list-disc text-primary">{corr}</li>
                                        ))}
                                      </ul>
                                    </div>
                                  )}

                                  {/* Frase melhor (ANTES → DEPOIS) */}
                                  {fraseMelhor && (fraseMelhor.antes || fraseMelhor.depois) && (
                                    <div className="bg-muted/50 rounded p-3">
                                      <p className="text-xs text-muted-foreground mb-2">Frase Melhor (ANTES → DEPOIS):</p>
                                      {fraseMelhor.antes && (
                                        <p className="text-sm mb-1">
                                          <span className="text-destructive font-medium">ANTES:</span> "{fraseMelhor.antes}"
                                        </p>
                                      )}
                                      {fraseMelhor.depois && (
                                        <p className="text-sm">
                                          <span className="text-success font-medium">DEPOIS:</span> "{fraseMelhor.depois}"
                                        </p>
                                      )}
                                    </div>
                                  )}

                                  {/* Perguntas de aprofundamento */}
                                  {stageData.perguntas_de_aprofundamento && stageData.perguntas_de_aprofundamento.length > 0 && (
                                    <div>
                                      <p className="text-xs text-muted-foreground mb-1">Perguntas de aprofundamento:</p>
                                      <ol className="text-sm space-y-1 pl-4 list-decimal">
                                        {stageData.perguntas_de_aprofundamento.map((perg, i) => (
                                          <li key={i} className="text-primary">{perg}</li>
                                        ))}
                                      </ol>
                                    </div>
                                  )}

                                  {/* Seeds de prova social */}
                                  {seedsProvaSocial && (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                      {seedsProvaSocial.usadas && seedsProvaSocial.usadas.length > 0 && (
                                        <div>
                                          <p className="text-xs text-muted-foreground mb-1">Seeds usadas:</p>
                                          <ul className="text-xs space-y-1 pl-3">
                                            {seedsProvaSocial.usadas.map((s, i) => (
                                              <li key={i} className="list-disc text-success">{s}</li>
                                            ))}
                                          </ul>
                                        </div>
                                      )}
                                      {seedsProvaSocial.faltaram && seedsProvaSocial.faltaram.length > 0 && (
                                        <div>
                                          <p className="text-xs text-muted-foreground mb-1">Seeds que faltaram:</p>
                                          <ul className="text-xs space-y-1 pl-3">
                                            {seedsProvaSocial.faltaram.map((s, i) => (
                                              <li key={i} className="list-disc text-warning">{s}</li>
                                            ))}
                                          </ul>
                                        </div>
                                      )}
                                    </div>
                                  )}

                                  {/* Risco principal */}
                                  {stageData.risco_principal_da_etapa && (
                                    <div className="bg-destructive/10 rounded p-2">
                                      <p className="text-xs text-destructive"><strong>Risco principal:</strong> {stageData.risco_principal_da_etapa}</p>
                                    </div>
                                  )}
                                </div>
                              </CollapsibleContent>
                            </div>
                          </Collapsible>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>

        </Tabs>
      </div>

      {/* Sale Dialog */}
      <SaleFormDialog
        client={client}
        open={saleDialogOpen}
        onOpenChange={setSaleDialogOpen}
        onSaleUpdated={fetchClientData}
      />

      {/* Activity Dialogs */}
      <IntensiveParticipationDialog
        client={client}
        open={intensiveDialogOpen}
        onOpenChange={setIntensiveDialogOpen}
        onActivityAdded={fetchClientData}
      />

      <MentoriaExtraDialog
        client={client}
        open={mentoriaDialogOpen}
        onOpenChange={setMentoriaDialogOpen}
        onActivityAdded={fetchClientData}
      />

      <ClientIndicationsDialog
        client={client}
        open={indicationsDialogOpen}
        onOpenChange={setIndicationsDialogOpen}
        onIndicationAdded={fetchClientData}
      />

      <IndicationSourceDialog
        client={client}
        open={indicationSourceDialogOpen}
        onOpenChange={setIndicationSourceDialogOpen}
        onLinked={fetchClientData}
      />
    </MainLayout>
  );
}
