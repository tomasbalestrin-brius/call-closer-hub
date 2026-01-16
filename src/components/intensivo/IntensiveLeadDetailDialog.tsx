import { useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Phone, 
  Mail, 
  Building2, 
  MapPin, 
  Calendar,
  Trash2,
  Save
} from 'lucide-react';
import { useIntensivoCRM } from '@/hooks/useIntensivoCRM';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { INTENSIVE_COLUMNS, INTENSIVE_STATUS_LABELS, type IntensiveLead, type IntensiveLeadStatus } from '@/types/intensivo';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface IntensiveLeadDetailDialogProps {
  lead: IntensiveLead | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editionId: string;
}

export function IntensiveLeadDetailDialog({ 
  lead, 
  open, 
  onOpenChange,
  editionId 
}: IntensiveLeadDetailDialogProps) {
  const { updateLead, deleteLead, moveLeadStatus } = useIntensivoCRM(editionId);
  const { isAdmin, isLeader } = useUserPermissions();
  const [isEditing, setIsEditing] = useState(false);
  const [showDeleteAlert, setShowDeleteAlert] = useState(false);
  const [editedLead, setEditedLead] = useState<Partial<IntensiveLead>>({});

  const canDeleteLead = isAdmin || isLeader;

  if (!lead) return null;

  const handleStatusChange = async (newStatus: IntensiveLeadStatus) => {
    await moveLeadStatus.mutateAsync({
      leadId: lead.id,
      newStatus,
    });
  };

  const handleSave = async () => {
    await updateLead.mutateAsync({
      id: lead.id,
      ...editedLead,
    });
    setIsEditing(false);
    setEditedLead({});
  };

  const handleDelete = async () => {
    await deleteLead.mutateAsync(lead.id);
    setShowDeleteAlert(false);
    onOpenChange(false);
  };

  const currentColumn = INTENSIVE_COLUMNS.find(c => c.id === lead.status);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle>{lead.name}</DialogTitle>
              <Badge className={currentColumn?.color}>
                {INTENSIVE_STATUS_LABELS[lead.status]}
              </Badge>
            </div>
          </DialogHeader>

          <Tabs defaultValue="info" className="mt-4">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="info">Informações</TabsTrigger>
              <TabsTrigger value="history">Histórico</TabsTrigger>
            </TabsList>

            <TabsContent value="info" className="space-y-4 mt-4">
              {/* Contact Info */}
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="w-4 h-4 text-muted-foreground" />
                  <span>{lead.phone || 'Não informado'}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="w-4 h-4 text-muted-foreground" />
                  <span>{lead.email || 'Não informado'}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Building2 className="w-4 h-4 text-muted-foreground" />
                  <span>{lead.company || 'Não informado'}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <MapPin className="w-4 h-4 text-muted-foreground" />
                  <span>{lead.niche || 'Não informado'}</span>
                </div>
              </div>

              <Separator />

              {/* Status Selector */}
              <div className="space-y-2">
                <Label>Mover para etapa</Label>
                <Select value={lead.status} onValueChange={handleStatusChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {INTENSIVE_COLUMNS.map((column) => (
                      <SelectItem key={column.id} value={column.id}>
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${column.color}`} />
                          {column.title}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <Label>Observações</Label>
                {isEditing ? (
                  <Textarea
                    value={editedLead.notes ?? lead.notes ?? ''}
                    onChange={(e) => setEditedLead({ ...editedLead, notes: e.target.value })}
                    rows={4}
                  />
                ) : (
                  <p className="text-sm text-muted-foreground bg-muted p-3 rounded-md">
                    {lead.notes || 'Nenhuma observação'}
                  </p>
                )}
              </div>

              {/* Source */}
              {lead.source && (
                <div className="space-y-2">
                  <Label>Origem</Label>
                  <Badge variant="outline">{lead.source}</Badge>
                </div>
              )}

              {/* Timestamps */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                {lead.confirmed_at && (
                  <div>
                    <span className="text-muted-foreground">Confirmado em: </span>
                    <span>{format(new Date(lead.confirmed_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })}</span>
                  </div>
                )}
                {lead.ticket_retrieved_at && (
                  <div>
                    <span className="text-muted-foreground">Ingresso retirado em: </span>
                    <span>{format(new Date(lead.ticket_retrieved_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })}</span>
                  </div>
                )}
                {lead.attended_at && (
                  <div>
                    <span className="text-muted-foreground">Compareceu em: </span>
                    <span>{format(new Date(lead.attended_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })}</span>
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="history" className="space-y-4 mt-4">
              <div className="space-y-4">
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted">
                  <Calendar className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Criado em</p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(lead.created_at), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR })}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted">
                  <Calendar className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Última movimentação</p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(lead.status_changed_at), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR })}
                    </p>
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>

          {/* Actions */}
          <div className="flex justify-between pt-4">
            {canDeleteLead && (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setShowDeleteAlert(true)}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Excluir
              </Button>
            )}

            <div className={`flex gap-2 ${!canDeleteLead ? 'ml-auto' : ''}`}>
              {isEditing ? (
                <>
                  <Button variant="outline" onClick={() => setIsEditing(false)}>
                    Cancelar
                  </Button>
                  <Button onClick={handleSave} disabled={updateLead.isPending}>
                    <Save className="w-4 h-4 mr-2" />
                    Salvar
                  </Button>
                </>
              ) : (
                <Button variant="outline" onClick={() => setIsEditing(true)}>
                  Editar
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={showDeleteAlert} onOpenChange={setShowDeleteAlert}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir lead?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O lead "{lead.name}" será removido permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
