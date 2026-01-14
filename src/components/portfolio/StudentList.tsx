import { useState } from 'react';
import StudentCard from './StudentCard';
import StudentDetailDialog from './StudentDetailDialog';
import { Skeleton } from '@/components/ui/skeleton';
import { useStudentEnrichedData } from '@/hooks/usePortfolio';
import type { PortfolioStudent } from '@/types';

interface StudentListProps {
  students: PortfolioStudent[];
  isLoading: boolean;
}

export default function StudentList({ students, isLoading }: StudentListProps) {
  const [selectedStudent, setSelectedStudent] = useState<PortfolioStudent | null>(null);
  const { enrichedDataMap, isLoading: isLoadingEnriched } = useStudentEnrichedData(students);
  
  if (isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-24 w-full" />
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
            enrichedData={student.client_id ? enrichedDataMap.get(student.client_id) : undefined}
            isLoadingEnriched={isLoadingEnriched}
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
