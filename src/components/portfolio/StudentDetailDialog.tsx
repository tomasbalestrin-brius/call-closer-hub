import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, Flame, Users, Trash2, Phone, Mail, Calendar, Building, ShoppingBag, DollarSign, FileText, Link as LinkIcon } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { TICKET_LABELS, ACTIVITY_TYPE_LABELS } from '@/types';
import { useDeleteStudent, useTicketUpgrades, useStudentActivities, useStudentIndications, useLinkedClient, useLinkedClientCalls } from '@/hooks/usePortfolio';
import UpgradeTicketDialog from './UpgradeTicketDialog';
import ActivityDialog from './ActivityDialog';
import StudentIndicationDialog from './StudentIndicationDialog';
import type { PortfolioStudent, TicketType } from '@/types';
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

interface StudentDetailDialogProps {
  student: PortfolioStudent | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const ticketStyles: Record<TicketType, string> = {
  '29_90': 'bg-amber-500/10 text-amber-600 border-amber-500/30',
  '12k': 'bg-sky-500/10 text-sky-600 border-sky-500/30',
  '80k': 'bg-yellow-500/10 text-yellow-600 border-yellow-500/30',
};

export default function StudentDetailDialog({ student, open, onOpenChange }: StudentDetailDialogProps) {
  const [isUpgradeOpen, setIsUpgradeOpen] = useState(false);
  const [isActivityOpen, setIsActivityOpen] = useState(false);
  const [isIndicationOpen, setIsIndicationOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  
  const deleteStudent = useDeleteStudent();
  const { data: allUpgrades } = useTicketUpgrades();
  const { data: allActivities } = useStudentActivities();
  const { data: allIndications } = useStudentIndications();
  const { data: linkedClient } = useLinkedClient(student?.client_id);
  const { data: linkedCalls } = useLinkedClientCalls(student?.client_id);
  
  if (!student) return null;
  
  const studentUpgrades = allUpgrades?.filter(u => u.student_id === student.id) || [];
  const studentActivities = allActivities?.filter(a => a.student_id === student.id) || [];
  const studentIndications = allIndications?.filter(i => i.student_id === student.id) || [];
  const hasLinkedClient = !!student.client_id && !!linkedClient;
  
  const handleDelete = async () => {
    await deleteStudent.mutateAsync(student.id);
    setIsDeleteOpen(false);
    onOpenChange(false);
  };
  
  const canUpgrade = student.current_ticket !== '80k';
  
  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <DialogTitle className="text-xl">{student.name}</DialogTitle>
                <Badge 
                  variant="outline" 
                  className={cn('font-medium', ticketStyles[student.current_ticket])}
                >
                  {TICKET_LABELS[student.current_ticket]}
                </Badge>
              </div>
            </div>
          </DialogHeader>
          
          {/* Student Info */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 py-4 border-b">
            {student.phone && (
              <div className="flex items-center gap-2 text-sm">
                <Phone className="w-4 h-4 text-muted-foreground" />
                <span>{student.phone}</span>
              </div>
            )}
            {student.email && (
              <div className="flex items-center gap-2 text-sm">
                <Mail className="w-4 h-4 text-muted-foreground" />
                <span className="truncate">{student.email}</span>
              </div>
            )}
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              <span>{format(new Date(student.entry_date), 'dd/MM/yyyy', { locale: ptBR })}</span>
            </div>
            {student.niche && (
              <div className="flex items-center gap-2 text-sm">
                <Building className="w-4 h-4 text-muted-foreground" />
                <span>{student.niche}</span>
              </div>
            )}
          </div>
          
          {/* Action Buttons */}
          <div className="flex flex-wrap gap-2 py-4">
            {canUpgrade && (
              <Button variant="outline" size="sm" onClick={() => setIsUpgradeOpen(true)}>
                <TrendingUp className="w-4 h-4 mr-2" />
                Registrar Ascensão
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => setIsActivityOpen(true)}>
              <Flame className="w-4 h-4 mr-2" />
              Registrar Atividade
            </Button>
            <Button variant="outline" size="sm" onClick={() => setIsIndicationOpen(true)}>
              <Users className="w-4 h-4 mr-2" />
              Nova Indicação
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              className="ml-auto text-destructive hover:text-destructive"
              onClick={() => setIsDeleteOpen(true)}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Excluir
            </Button>
          </div>
          
          {/* Linked Client Info Card */}
          {hasLinkedClient && (
            <Card className="border-primary/20 bg-primary/5">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <LinkIcon className="w-4 h-4" />
                  Dados da Venda Original
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {linkedClient.product_offered && (
                    <div className="flex items-center gap-2 text-sm">
                      <ShoppingBag className="w-4 h-4 text-muted-foreground" />
                      <div>
                        <p className="text-xs text-muted-foreground">Produto</p>
                        <p className="font-medium">{linkedClient.product_offered}</p>
                      </div>
                    </div>
                  )}
                  {linkedClient.sale_value && (
                    <div className="flex items-center gap-2 text-sm">
                      <DollarSign className="w-4 h-4 text-muted-foreground" />
                      <div>
                        <p className="text-xs text-muted-foreground">Valor Venda</p>
                        <p className="font-medium text-green-600">
                          {linkedClient.sale_value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </p>
                      </div>
                    </div>
                  )}
                  {linkedClient.entry_value && (
                    <div className="flex items-center gap-2 text-sm">
                      <DollarSign className="w-4 h-4 text-muted-foreground" />
                      <div>
                        <p className="text-xs text-muted-foreground">Entrada</p>
                        <p className="font-medium">
                          {linkedClient.entry_value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </p>
                      </div>
                    </div>
                  )}
                  {linkedClient.sold_at && (
                    <div className="flex items-center gap-2 text-sm">
                      <Calendar className="w-4 h-4 text-muted-foreground" />
                      <div>
                        <p className="text-xs text-muted-foreground">Data Venda</p>
                        <p className="font-medium">
                          {format(new Date(linkedClient.sold_at), 'dd/MM/yyyy', { locale: ptBR })}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
                
                {/* Calls History */}
                {linkedCalls && linkedCalls.length > 0 && (
                  <div className="pt-2 border-t">
                    <p className="text-xs text-muted-foreground mb-2">
                      <FileText className="w-3 h-3 inline mr-1" />
                      {linkedCalls.length} call(s) realizada(s)
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {linkedCalls.slice(0, 3).map((call) => (
                        <Badge key={call.id} variant="outline" className="text-xs">
                          {format(new Date(call.call_date), 'dd/MM', { locale: ptBR })} - {call.status}
                          {call.score && ` (${call.score}pts)`}
                        </Badge>
                      ))}
                      {linkedCalls.length > 3 && (
                        <Badge variant="secondary" className="text-xs">
                          +{linkedCalls.length - 3} mais
                        </Badge>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Tabs */}
          <Tabs defaultValue="upgrades" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="upgrades">
                Ascensões ({studentUpgrades.length})
              </TabsTrigger>
              <TabsTrigger value="activities">
                Atividades ({studentActivities.length})
              </TabsTrigger>
              <TabsTrigger value="indications">
                Indicações ({studentIndications.length})
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="upgrades" className="mt-4 space-y-3">
              {studentUpgrades.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">Nenhuma ascensão registrada</p>
              ) : (
                studentUpgrades.map((upgrade) => (
                  <Card key={upgrade.id}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className={ticketStyles[upgrade.from_ticket]}>
                            {TICKET_LABELS[upgrade.from_ticket]}
                          </Badge>
                          <span className="text-muted-foreground">→</span>
                          <Badge variant="outline" className={ticketStyles[upgrade.to_ticket]}>
                            {TICKET_LABELS[upgrade.to_ticket]}
                          </Badge>
                        </div>
                        <div className="text-right text-sm">
                          <p className="font-medium">
                            {upgrade.sale_value?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                          </p>
                          <p className="text-muted-foreground">
                            {format(new Date(upgrade.upgrade_date), 'dd/MM/yyyy', { locale: ptBR })}
                          </p>
                        </div>
                      </div>
                      {upgrade.notes && (
                        <p className="text-sm text-muted-foreground mt-2">{upgrade.notes}</p>
                      )}
                    </CardContent>
                  </Card>
                ))
              )}
            </TabsContent>
            
            <TabsContent value="activities" className="mt-4 space-y-3">
              {studentActivities.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">Nenhuma atividade registrada</p>
              ) : (
                studentActivities.map((activity) => (
                  <Card key={activity.id}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">{activity.activity_name}</p>
                          <Badge variant="secondary" className="mt-1">
                            {ACTIVITY_TYPE_LABELS[activity.activity_type]}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {format(new Date(activity.activity_date), 'dd/MM/yyyy', { locale: ptBR })}
                        </p>
                      </div>
                      {activity.notes && (
                        <p className="text-sm text-muted-foreground mt-2">{activity.notes}</p>
                      )}
                    </CardContent>
                  </Card>
                ))
              )}
            </TabsContent>
            
            <TabsContent value="indications" className="mt-4 space-y-3">
              {studentIndications.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">Nenhuma indicação registrada</p>
              ) : (
                studentIndications.map((indication) => (
                  <Card key={indication.id}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">{indication.indicated_name}</p>
                          <p className="text-sm text-muted-foreground">{indication.indicated_phone}</p>
                        </div>
                        <div className="text-right">
                          <Badge variant="secondary">{indication.indication_type}</Badge>
                          <p className="text-sm text-muted-foreground mt-1">
                            {format(new Date(indication.created_at), 'dd/MM/yyyy', { locale: ptBR })}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </TabsContent>
          </Tabs>
          
          {/* Notes */}
          {student.notes && (
            <Card className="mt-4">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Observações</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{student.notes}</p>
              </CardContent>
            </Card>
          )}
        </DialogContent>
      </Dialog>
      
      {/* Sub-dialogs */}
      <UpgradeTicketDialog 
        student={student} 
        open={isUpgradeOpen} 
        onOpenChange={setIsUpgradeOpen} 
      />
      <ActivityDialog 
        student={student} 
        open={isActivityOpen} 
        onOpenChange={setIsActivityOpen} 
      />
      <StudentIndicationDialog 
        student={student} 
        open={isIndicationOpen} 
        onOpenChange={setIsIndicationOpen} 
      />
      
      {/* Delete Confirmation */}
      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir aluno?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. Isso excluirá permanentemente o aluno 
              "{student.name}" e todos os seus dados (ascensões, atividades).
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
