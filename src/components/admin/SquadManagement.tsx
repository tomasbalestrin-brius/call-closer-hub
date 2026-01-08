import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Users2, 
  Plus, 
  Trash2, 
  Edit2, 
  Loader2,
  UserPlus
} from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SquadMembersDialog } from './SquadMembersDialog';

interface Squad {
  id: string;
  name: string;
  created_by: string;
  created_at: string;
  member_count?: number;
}

export function SquadManagement() {
  const [squads, setSquads] = useState<Squad[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [membersDialogOpen, setMembersDialogOpen] = useState(false);
  const [selectedSquad, setSelectedSquad] = useState<Squad | null>(null);
  const [squadName, setSquadName] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchSquads();
  }, []);

  const fetchSquads = async () => {
    try {
      const { data: squadsData, error: squadsError } = await supabase
        .from('squads')
        .select('*')
        .order('created_at', { ascending: false });

      if (squadsError) throw squadsError;

      // Get member counts for each squad
      const squadsWithCounts = await Promise.all(
        (squadsData || []).map(async (squad) => {
          const { count } = await supabase
            .from('squad_members')
            .select('*', { count: 'exact', head: true })
            .eq('squad_id', squad.id);
          
          return { ...squad, member_count: count || 0 };
        })
      );

      setSquads(squadsWithCounts);
    } catch (error) {
      console.error('Error fetching squads:', error);
      toast.error('Erro ao carregar squads');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSquad = async () => {
    if (!squadName.trim()) {
      toast.error('Digite o nome do squad');
      return;
    }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { error } = await supabase
        .from('squads')
        .insert({ name: squadName.trim(), created_by: user.id });

      if (error) throw error;

      toast.success('Squad criado com sucesso!');
      setSquadName('');
      setCreateDialogOpen(false);
      fetchSquads();
    } catch (error) {
      console.error('Error creating squad:', error);
      toast.error('Erro ao criar squad');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateSquad = async () => {
    if (!selectedSquad || !squadName.trim()) {
      toast.error('Digite o nome do squad');
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('squads')
        .update({ name: squadName.trim() })
        .eq('id', selectedSquad.id);

      if (error) throw error;

      toast.success('Squad atualizado com sucesso!');
      setSquadName('');
      setEditDialogOpen(false);
      setSelectedSquad(null);
      fetchSquads();
    } catch (error) {
      console.error('Error updating squad:', error);
      toast.error('Erro ao atualizar squad');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteSquad = async (squad: Squad) => {
    if (!confirm(`Tem certeza que deseja excluir o squad "${squad.name}"?`)) return;

    try {
      const { error } = await supabase
        .from('squads')
        .delete()
        .eq('id', squad.id);

      if (error) throw error;

      toast.success('Squad excluído com sucesso!');
      fetchSquads();
    } catch (error) {
      console.error('Error deleting squad:', error);
      toast.error('Erro ao excluir squad');
    }
  };

  const openEditDialog = (squad: Squad) => {
    setSelectedSquad(squad);
    setSquadName(squad.name);
    setEditDialogOpen(true);
  };

  const openMembersDialog = (squad: Squad) => {
    setSelectedSquad(squad);
    setMembersDialogOpen(true);
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="font-display flex items-center gap-2">
                <Users2 className="w-5 h-5" />
                Gestão de Squads
              </CardTitle>
              <CardDescription>
                Crie e gerencie equipes de closers
              </CardDescription>
            </div>
            <Button onClick={() => setCreateDialogOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Novo Squad
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {squads.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum squad criado ainda
            </div>
          ) : (
            <div className="space-y-3">
              {squads.map((squad) => (
                <div
                  key={squad.id}
                  className="flex items-center justify-between p-4 rounded-lg border bg-card hover:shadow-md transition-shadow"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <Users2 className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold">{squad.name}</h3>
                      <p className="text-sm text-muted-foreground">
                        {squad.member_count} membro{squad.member_count !== 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openMembersDialog(squad)}
                    >
                      <UserPlus className="w-4 h-4 mr-1" />
                      Membros
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openEditDialog(squad)}
                    >
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDeleteSquad(squad)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Squad Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Criar Novo Squad</DialogTitle>
            <DialogDescription>
              Digite o nome do novo squad para criar.
            </DialogDescription>
          </DialogHeader>
          <Input
            placeholder="Nome do squad"
            value={squadName}
            onChange={(e) => setSquadName(e.target.value)}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreateSquad} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Criar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Squad Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Squad</DialogTitle>
            <DialogDescription>
              Altere o nome do squad.
            </DialogDescription>
          </DialogHeader>
          <Input
            placeholder="Nome do squad"
            value={squadName}
            onChange={(e) => setSquadName(e.target.value)}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleUpdateSquad} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Members Dialog */}
      {selectedSquad && (
        <SquadMembersDialog
          open={membersDialogOpen}
          onOpenChange={setMembersDialogOpen}
          squad={selectedSquad}
          onMembersChange={fetchSquads}
        />
      )}
    </>
  );
}
