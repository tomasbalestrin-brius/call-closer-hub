import { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import MainLayout from '@/components/layout/MainLayout';
import { useAuth } from '@/hooks/useAuth';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { useIntensivoCRM } from '@/hooks/useIntensivoCRM';
import { EditionSelector } from '@/components/intensivo/EditionSelector';
import { NewEditionDialog } from '@/components/intensivo/NewEditionDialog';
import { NewIntensiveLeadDialog } from '@/components/intensivo/NewIntensiveLeadDialog';
import { IntensiveStatsBar } from '@/components/intensivo/IntensiveStatsBar';
import { IntensiveActiveFilters } from '@/components/intensivo/IntensiveActiveFilters';
import { IntensivePeriodSummary } from '@/components/intensivo/IntensivePeriodSummary';
import { IntensiveLeadGridCard } from '@/components/intensivo/IntensiveLeadGridCard';
import { IntensiveLeadDetailDialog } from '@/components/intensivo/IntensiveLeadDetailDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Search, Flame, Trash2, LayoutGrid, Columns, AlertCircle, RefreshCw, Thermometer } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import type { IntensiveLead, IntensiveLeadStatus, LeadTemperature } from '@/types/intensivo';

// View mode toggle
import { IntensiveKanban } from '@/components/intensivo/IntensiveKanban';

export default function IntensivoCRM() {
  const { user, loading: authLoading } = useAuth();
  const { canDeleteCalls } = useUserPermissions();
  const [selectedEditionId, setSelectedEditionId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<IntensiveLeadStatus | 'all'>('all');
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [temperatureFilter, setTemperatureFilter] = useState<LeadTemperature | 'all'>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'kanban'>('kanban');
  const [showNewEditionDialog, setShowNewEditionDialog] = useState(false);
  const [showNewLeadDialog, setShowNewLeadDialog] = useState(false);
  const [selectedLead, setSelectedLead] = useState<IntensiveLead | null>(null);
  const [selectedLeads, setSelectedLeads] = useState<string[]>([]);

  const { 
    editions, 
    leads, 
    loadingEditions, 
    loadingLeads, 
    editionsError,
    leadsError,
    isAdmin 
  } = useIntensivoCRM(selectedEditionId || undefined);

  // Auto-select first active edition

  useEffect(() => {
    if (editions.length > 0 && !selectedEditionId) {
      const activeEdition = editions.find(e => e.is_active) || editions[0];
      setSelectedEditionId(activeEdition.id);
    }
  }, [editions, selectedEditionId]);

  if (authLoading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </MainLayout>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // Error state handling
  if (editionsError || leadsError) {
    return (
      <MainLayout>
        <div className="flex flex-col items-center justify-center h-64 gap-4">
          <Alert variant="destructive" className="max-w-md">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Erro ao carregar dados</AlertTitle>
            <AlertDescription>
              Ocorreu um problema ao carregar os dados do CRM Intensivo. 
              Verifique sua conexão e tente novamente.
            </AlertDescription>
          </Alert>
          <Button 
            onClick={() => window.location.reload()} 
            variant="outline"
            className="gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Recarregar página
          </Button>
        </div>
      </MainLayout>
    );
  }

  // Get unique sources for filter
  const uniqueSources = [...new Set(leads.map(l => l.source).filter(Boolean))] as string[];

  // Filter leads
  const filteredLeads = leads.filter(lead => {
    const matchesSearch = 
      lead.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lead.company?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lead.phone?.includes(searchQuery) ||
      lead.email?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || lead.status === statusFilter;
    const matchesSource = sourceFilter === 'all' || lead.source === sourceFilter;
    const matchesTemperature = temperatureFilter === 'all' || lead.lead_temperature === temperatureFilter;
    
    return matchesSearch && matchesStatus && matchesSource && matchesTemperature;
  });

  const selectedEdition = editions.find(e => e.id === selectedEditionId);

  const toggleLeadSelection = (leadId: string) => {
    setSelectedLeads(prev => 
      prev.includes(leadId) 
        ? prev.filter(id => id !== leadId)
        : [...prev, leadId]
    );
  };

  const handleDeleteSelected = async () => {
    if (selectedLeads.length === 0) return;
    
    if (!confirm(`Tem certeza que deseja excluir ${selectedLeads.length} lead(s)?`)) return;

    try {
      const { error } = await supabase
        .from('intensive_leads')
        .delete()
        .in('id', selectedLeads);

      if (error) throw error;

      toast.success(`${selectedLeads.length} lead(s) excluído(s)`);
      setSelectedLeads([]);
    } catch (error) {
      console.error('Error deleting leads:', error);
      toast.error('Erro ao excluir leads');
    }
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-orange-500/10">
              <Flame className="w-6 h-6 text-orange-500" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">CRM Intensivo</h1>
              <p className="text-sm text-muted-foreground">
                Gerencie leads para o Intensivo da Alta Performance
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* View Mode Toggle */}
            <div className="flex items-center border rounded-lg overflow-hidden">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2 ${viewMode === 'grid' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
                title="Visualização em Grid"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('kanban')}
                className={`p-2 ${viewMode === 'kanban' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
                title="Visualização Kanban"
              >
                <Columns className="w-4 h-4" />
              </button>
            </div>

            <EditionSelector
              editions={editions}
              selectedEditionId={selectedEditionId}
              onSelect={setSelectedEditionId}
              loading={loadingEditions}
            />
            
            {isAdmin && (
              <Button 
                variant="outline" 
                onClick={() => setShowNewEditionDialog(true)}
              >
                <Plus className="w-4 h-4 mr-2" />
                Nova Edição
              </Button>
            )}

            {canDeleteCalls && selectedLeads.length > 0 && (
              <Button 
                variant="destructive" 
                size="sm"
                onClick={handleDeleteSelected}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Excluir ({selectedLeads.length})
              </Button>
            )}
            
            <Button onClick={() => setShowNewLeadDialog(true)} disabled={!selectedEditionId}>
              <Plus className="w-4 h-4 mr-2" />
              Novo Lead
            </Button>
          </div>
        </div>

        {/* Stats Bar */}
        {selectedEditionId && (
          <IntensiveStatsBar 
            leads={leads} 
            onStatusFilter={setStatusFilter} 
            activeStatus={statusFilter} 
          />
        )}

        {/* Period Summary */}
        {selectedEditionId && (
          <IntensivePeriodSummary 
            leads={filteredLeads} 
            edition={selectedEdition}
          />
        )}

        {/* Filters */}
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, empresa, telefone ou email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          
          {uniqueSources.length > 0 && (
            <Select value={sourceFilter} onValueChange={setSourceFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Origem" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as origens</SelectItem>
                {uniqueSources.map(source => (
                  <SelectItem key={source} value={source}>{source}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <Select value={temperatureFilter} onValueChange={(v) => setTemperatureFilter(v as LeadTemperature | 'all')}>
            <SelectTrigger className="w-[180px]">
              <Thermometer className="w-4 h-4 mr-2" />
              <SelectValue placeholder="Temperatura" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas temperaturas</SelectItem>
              <SelectItem value="quente">🔥 Quente</SelectItem>
              <SelectItem value="morno">🌡️ Morno</SelectItem>
              <SelectItem value="frio">❄️ Frio</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Active Filters Chips */}
        <IntensiveActiveFilters
          searchQuery={searchQuery}
          statusFilter={statusFilter}
          sourceFilter={sourceFilter}
          temperatureFilter={temperatureFilter}
          onClearSearch={() => setSearchQuery('')}
          onClearStatus={() => setStatusFilter('all')}
          onClearSource={() => setSourceFilter('all')}
          onClearTemperature={() => setTemperatureFilter('all')}
          onClearAll={() => {
            setSearchQuery('');
            setStatusFilter('all');
            setSourceFilter('all');
            setTemperatureFilter('all');
          }}
        />

        {/* Content */}
        {selectedEditionId ? (
          viewMode === 'kanban' ? (
            <IntensiveKanban
              leads={filteredLeads}
              editionId={selectedEditionId}
              loading={loadingLeads}
              edition={selectedEdition}
            />
          ) : (
            // Grid View (similar to Calls page)
            loadingLeads ? (
              <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : filteredLeads.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredLeads.map((lead) => (
                  <div key={lead.id} className="relative">
                    {canDeleteCalls && (
                      <input
                        type="checkbox"
                        checked={selectedLeads.includes(lead.id)}
                        onChange={() => toggleLeadSelection(lead.id)}
                        className="absolute top-4 right-4 z-10 w-4 h-4 accent-primary"
                      />
                    )}
                    <IntensiveLeadGridCard 
                      lead={lead} 
                      onClick={() => setSelectedLead(lead)}
                    />
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 bg-card rounded-xl border">
                <Flame className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">
                  {searchQuery || statusFilter !== 'all' || sourceFilter !== 'all'
                    ? 'Nenhum lead encontrado com esses filtros'
                    : 'Nenhum lead registrado ainda'}
                </p>
              </div>
            )
          )
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            {loadingEditions ? (
              <div className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : editions.length === 0 ? (
              <div>
                <p>Nenhuma edição do Intensivo cadastrada.</p>
                {isAdmin && (
                  <Button 
                    className="mt-4" 
                    onClick={() => setShowNewEditionDialog(true)}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Criar Primeira Edição
                  </Button>
                )}
              </div>
            ) : (
              <p>Selecione uma edição do Intensivo</p>
            )}
          </div>
        )}
      </div>

      {/* Dialogs */}
      <NewEditionDialog
        open={showNewEditionDialog}
        onOpenChange={setShowNewEditionDialog}
      />
      
      <NewIntensiveLeadDialog
        open={showNewLeadDialog}
        onOpenChange={setShowNewLeadDialog}
        editionId={selectedEditionId || ''}
      />

      <IntensiveLeadDetailDialog
        lead={selectedLead}
        open={!!selectedLead}
        onOpenChange={(open) => !open && setSelectedLead(null)}
        editionId={selectedEditionId || ''}
      />
    </MainLayout>
  );
}
