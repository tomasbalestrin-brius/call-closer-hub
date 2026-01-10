import { useState } from 'react';
import StudentCard from './StudentCard';
import StudentDetailDialog from './StudentDetailDialog';
import { Skeleton } from '@/components/ui/skeleton';
import type { PortfolioStudent } from '@/types';

interface StudentListProps {
  students: PortfolioStudent[];
  isLoading: boolean;
}

export default function StudentList({ students, isLoading }: StudentListProps) {
  const [selectedStudent, setSelectedStudent] = useState<PortfolioStudent | null>(null);
  
  if (isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
    );
  }
  
  if (students.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p className="text-lg">Nenhum aluno encontrado</p>
        <p className="text-sm mt-1">Adicione seu primeiro aluno clicando no botão acima</p>
      </div>
    );
  }
  
  return (
    <>
      <div className="space-y-3">
        {students.map((student) => (
          <StudentCard
            key={student.id}
            student={student}
            onClick={() => setSelectedStudent(student)}
          />
        ))}
      </div>
      
      <StudentDetailDialog
        student={selectedStudent}
        open={!!selectedStudent}
        onOpenChange={(open) => !open && setSelectedStudent(null)}
      />
    </>
  );
}
