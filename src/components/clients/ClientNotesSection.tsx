import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { ClientNote } from '@/types';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Plus, Trash2, Loader2, MessageSquare } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ClientNotesSectionProps {
  clientId: string;
}

export default function ClientNotesSection({ clientId }: ClientNotesSectionProps) {
  const { user } = useAuth();
  const [notes, setNotes] = useState<ClientNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [newNote, setNewNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    if (user && clientId) {
      fetchNotes();
    }
  }, [user, clientId]);

  const fetchNotes = async () => {
    try {
      const { data, error } = await supabase
        .from('client_notes')
        .select('*')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setNotes(data as ClientNote[]);
    } catch (error) {
      console.error('Error fetching notes:', error);
    } finally {
      setLoading(false);
    }
  };

  const addNote = async () => {
    if (!user || !newNote.trim()) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('client_notes')
        .insert({
          client_id: clientId,
          user_id: user.id,
          content: newNote.trim(),
        });

      if (error) throw error;

      toast.success('Nota adicionada!');
      setNewNote('');
      fetchNotes();
    } catch (error) {
      console.error('Error adding note:', error);
      toast.error('Erro ao adicionar nota');
    } finally {
      setSaving(false);
    }
  };

  const deleteNote = async (noteId: string) => {
    setDeletingId(noteId);
    try {
      const { error } = await supabase
        .from('client_notes')
        .delete()
        .eq('id', noteId);

      if (error) throw error;

      toast.success('Nota removida!');
      setNotes(notes.filter((n) => n.id !== noteId));
    } catch (error) {
      console.error('Error deleting note:', error);
      toast.error('Erro ao remover nota');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Add Note Form */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Nova Anotação</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            placeholder="Digite sua anotação..."
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            rows={3}
          />
          <Button 
            onClick={addNote} 
            disabled={saving || !newNote.trim()}
            size="sm"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Plus className="w-4 h-4 mr-2" />
            )}
            Adicionar
          </Button>
        </CardContent>
      </Card>

      {/* Notes List */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <MessageSquare className="w-4 h-4" />
            Histórico de Anotações ({notes.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-4 text-muted-foreground">
              Carregando...
            </div>
          ) : notes.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>Nenhuma anotação ainda</p>
            </div>
          ) : (
            <ScrollArea className="h-[400px] pr-4">
              <div className="space-y-3">
                {notes.map((note) => (
                  <div 
                    key={note.id} 
                    className="border rounded-lg p-3 bg-muted/30"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm whitespace-pre-wrap flex-1">
                        {note.content}
                      </p>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => deleteNote(note.id)}
                        disabled={deletingId === note.id}
                      >
                        {deletingId === note.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      {format(new Date(note.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </p>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
