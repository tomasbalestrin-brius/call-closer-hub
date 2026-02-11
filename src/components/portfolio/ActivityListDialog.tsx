import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Phone, User } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ACTIVITY_TYPE_LABELS } from '@/types';
import { usePortfolioStudents, useStudentActivities } from '@/hooks/usePortfolio';
import StudentDetailDialog from './StudentDetailDialog';
import type { PortfolioStudent, StudentActivityType } from '@/types';

interface ActivityListDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activityType: StudentActivityType;
  title: string;
}

export default function ActivityListDialog({ open, onOpenChange, activityType, title }: ActivityListDialogProps) {
  const { data: students } = usePortfolioStudents();
  const { data: activities } = useStudentActivities();
  const [selectedStudent, setSelectedStudent] = useState<PortfolioStudent | null>(null);

  const studentsWithActivity = (students || []).filter(student => {
    return activities?.some(a => a.student_id === student.id && a.activity_type === activityType);
  });

  const getStudentActivities = (studentId: string) => {
    return activities?.filter(a => a.student_id === studentId && a.activity_type === activityType) || [];
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[500px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{title} ({studentsWithActivity.length})</DialogTitle>
          </DialogHeader>

          <div className="space-y-2 mt-4">
            {studentsWithActivity.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">Nenhum aluno encontrado</p>
            ) : (
              studentsWithActivity.map(student => {
                const acts = getStudentActivities(student.id);
                return (
                  <Card
                    key={student.id}
                    className="cursor-pointer hover:border-primary/50 transition-colors"
                    onClick={() => {
                      onOpenChange(false);
                      setSelectedStudent(student);
                    }}
                  >
                    <CardContent className="p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                            <User className="w-4 h-4 text-muted-foreground" />
                          </div>
                          <div>
                            <p className="font-medium text-sm">{student.name}</p>
                            {student.phone && (
                              <p className="text-xs text-muted-foreground flex items-center gap-1">
                                <Phone className="w-3 h-3" />
                                {student.phone}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          {acts.map(a => (
                            <Badge key={a.id} variant="outline" className="text-xs">
                              {format(new Date(a.activity_date), 'dd/MM/yy', { locale: ptBR })}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        </DialogContent>
      </Dialog>

      <StudentDetailDialog
        student={selectedStudent}
        open={!!selectedStudent}
        onOpenChange={(open) => !open && setSelectedStudent(null)}
      />
    </>
  );
}
