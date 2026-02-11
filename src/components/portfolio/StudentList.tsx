import { useState, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
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
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: students.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 108,
    overscan: 3,
  });

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
      <div
        ref={parentRef}
        style={{ maxHeight: 'calc(100vh - 400px)', overflowY: 'auto' }}
      >
        <div
          style={{
            height: virtualizer.getTotalSize(),
            position: 'relative',
            width: '100%',
          }}
        >
          {virtualizer.getVirtualItems().map((virtualRow) => {
            const student = students[virtualRow.index];
            return (
              <div
                key={student.id}
                data-index={virtualRow.index}
                ref={virtualizer.measureElement}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              >
                <div className="pb-3">
                  <StudentCard
                    student={student}
                    enrichedData={student.client_id ? enrichedDataMap.get(student.client_id) : undefined}
                    isLoadingEnriched={isLoadingEnriched}
                    onClick={() => setSelectedStudent(student)}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <StudentDetailDialog
        student={selectedStudent}
        open={!!selectedStudent}
        onOpenChange={(open) => !open && setSelectedStudent(null)}
      />
    </>
  );
}
