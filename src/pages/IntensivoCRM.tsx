import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import MainLayout from '@/components/layout/MainLayout';
import { useAuth } from '@/hooks/useAuth';
import { useIntensivoCRM } from '@/hooks/useIntensivoCRM';
import { IntensiveKanban } from '@/components/intensivo/IntensiveKanban';
import { EditionSelector } from '@/components/intensivo/EditionSelector';
import { NewEditionDialog } from '@/components/intensivo/NewEditionDialog';
import { NewIntensiveLeadDialog } from '@/components/intensivo/NewIntensiveLeadDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Search, Flame } from 'lucide-react';

export default function IntensivoCRM() {
  const { user, loading: authLoading } = useAuth();
  const [selectedEditionId, setSelectedEditionId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showNewEditionDialog, setShowNewEditionDialog] = useState(false);
  const [showNewLeadDialog, setShowNewLeadDialog] = useState(false);

  const { editions, leads, loadingEditions, loadingLeads, isAdmin } = useIntensivoCRM(selectedEditionId || undefined);

  // Auto-select first active edition
  useState(() => {
    if (editions.length > 0 && !selectedEditionId) {
      const activeEdition = editions.find(e => e.is_active) || editions[0];
      setSelectedEditionId(activeEdition.id);
    }
  });

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

  const filteredLeads = leads.filter(lead => 
    lead.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    lead.company?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    lead.phone?.includes(searchQuery)
  );

  const selectedEdition = editions.find(e => e.id === selectedEditionId);

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

          <div className="flex items-center gap-2">
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
            
            <Button onClick={() => setShowNewLeadDialog(true)} disabled={!selectedEditionId}>
              <Plus className="w-4 h-4 mr-2" />
              Novo Lead
            </Button>
          </div>
        </div>

        {/* Search */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar lead..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Kanban */}
        {selectedEditionId ? (
          <IntensiveKanban
            leads={filteredLeads}
            editionId={selectedEditionId}
            loading={loadingLeads}
            edition={selectedEdition}
          />
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
    </MainLayout>
  );
}
