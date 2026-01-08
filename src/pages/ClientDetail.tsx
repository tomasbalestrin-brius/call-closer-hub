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
import ClientEditDialog from '@/components/clients/ClientEditDialog';

import SaleFormDialog from '@/components/clients/SaleFormDialog';
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
  Merge
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
import { Client, Call, CallStatus, StageAnalysis } from '@/types';
import { cn } from '@/lib/utils';

const statusConfig: Record<CallStatus, { label: string; className: string }> = {
  pendente: { label: 'Pendente', className: 'bg-secondary text-secondary-foreground' },
  em_andamento: { label: 'Em andamento', className: 'bg-info text-info-foreground' },
  follow_up: { label: 'Follow-up', className: 'bg-warning text-warning-foreground' },
  proposta_enviada: { label: 'Proposta enviada', className: 'bg-info text-info-foreground' },
  vendido: { label: 'Vendido', className: 'bg-success text-success-foreground' },
  perdido: { label: 'Perdido', className: 'bg-destructive text-destructive-foreground' },
};

// Nova ordem do Framework Julia Ottoni
const stageOrder = [
  'conexao',
  'abertura',
  'mapeamento_negocio',
  'mapeamento_problemas',
  'consultoria',
  'problematizacao',
  'solucao_imaginada',
  'pitch',
  'contorno_objecoes',
  'fechamento'
];

const stageLabels: Record<string, string> = {
  conexao: 'Conexão',
  abertura: 'Abertura',
  mapeamento_negocio: 'Mapeamento do Negócio',
  mapeamento_problemas: 'Mapeamento do Problema',
  consultoria: 'Consultoria',
  problematizacao: 'Problematização',
  solucao_imaginada: 'Solução Imaginada',
  pitch: 'Pitch',
  contorno_objecoes: 'Contorno de Objeções',
  fechamento: 'Fechamento',
  // Legado (para compatibilidade)
  transicao: 'Transição',
  perguntas_compromisso: 'Perguntas de Compromisso',
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
            Voltar para Clientes
          </Button>
        </div>
      </MainLayout>
    );
  }

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

        {/* Sale Info Banner */}
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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Contact Info */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Contato</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {client.email && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Mail className="w-4 h-4" />
                  <span>{client.email}</span>
                </div>
              )}
              {client.phone && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Phone className="w-4 h-4" />
                  <span>{client.phone}</span>
                </div>
              )}
              {!client.email && !client.phone && (
                <p className="text-muted-foreground text-xs">Nenhum contato cadastrado</p>
              )}
            </CardContent>
          </Card>

          {/* Business Info */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Negócio</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {client.niche && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Briefcase className="w-4 h-4" />
                  <span>{client.niche}</span>
                </div>
              )}
              {client.revenue && (
                <div className="flex items-center gap-2 text-success font-medium">
                  <DollarSign className="w-4 h-4" />
                  <span>{formatCurrency(client.revenue)}</span>
                </div>
              )}
              {client.has_partner !== null && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Users className="w-4 h-4" />
                  <span>{client.has_partner ? 'Com sócio' : 'Sem sócio'}</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Pain Points */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Perfil</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
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
        </div>

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
                {/* Overview - Apenas Nota Geral */}
                <Card className="max-w-xs">
                  <CardContent className="pt-6 text-center">
                    <div className={cn("text-5xl font-bold", getScoreColor(selectedCall.score || 0))}>
                      {selectedCall.score || 0}
                    </div>
                    <p className="text-sm text-muted-foreground mt-2">Nota Geral</p>
                  </CardContent>
                </Card>

                {/* Errors and Wins */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-success" />
                        Maiores Acertos
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-2">
                        {selectedCall.main_wins?.map((win, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm">
                            <TrendingUp className="w-4 h-4 text-success flex-shrink-0 mt-0.5" />
                            <span>{win}</span>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-destructive" />
                        Maiores Erros
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-2">
                        {selectedCall.main_errors?.map((error, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm">
                            <XCircle className="w-4 h-4 text-destructive flex-shrink-0 mt-0.5" />
                            <span>{error}</span>
                          </li>
                        ))}
                      </ul>
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
                    <CardDescription>Avaliação detalhada de cada etapa da call</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {Object.entries(selectedCall.technical_analysis).map(([key, stage]) => {
                        const stageData = stage as StageAnalysis;
                        if (!stageData) return null;
                        return (
                          <div key={key} className="border rounded-lg p-4">
                            <div className="flex items-center justify-between mb-2">
                              <h4 className="font-medium">{stageLabels[key] || key}</h4>
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
                                <span className={cn("font-bold", getScoreColor(stageData.nota))}>
                                  {stageData.nota}/10
                                </span>
                              </div>
                            </div>
                            <Progress 
                              value={stageData.nota * 10} 
                              className={cn(
                                "h-2",
                                stageData.nota >= 8 && "[&>div]:bg-success",
                                stageData.nota >= 6 && stageData.nota < 8 && "[&>div]:bg-warning",
                                stageData.nota < 6 && "[&>div]:bg-destructive"
                              )} 
                            />
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3 text-sm">
                              {stageData.ponto_forte && (
                                <div>
                                  <p className="text-xs text-muted-foreground mb-1">Ponto forte:</p>
                                  <p className="text-success">{stageData.ponto_forte}</p>
                                </div>
                              )}
                              {stageData.ponto_fraco && (
                                <div>
                                  <p className="text-xs text-muted-foreground mb-1">Ponto fraco:</p>
                                  <p className="text-destructive">{stageData.ponto_fraco}</p>
                                </div>
                              )}
                              {stageData.sugestao && (
                                <div className="md:col-span-2">
                                  <p className="text-xs text-muted-foreground mb-1">Sugestão:</p>
                                  <p className="text-primary">{stageData.sugestao}</p>
                                </div>
                              )}
                            </div>
                          </div>
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
    </MainLayout>
  );
}
