import { Skeleton } from '@/components/ui/skeleton';

interface CardListSkeletonProps {
  count?: number;
  columns?: number;
}

export function CardSkeleton() {
  return (
    <div className="rounded-xl border border-border p-4 bg-card shadow-card space-y-3">
      <div className="flex items-center gap-3">
        <Skeleton className="w-10 h-10 rounded-full" />
        <div className="flex-1 space-y-1.5">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-24" />
        </div>
        <Skeleton className="h-6 w-16 rounded-full" />
      </div>
      <div className="flex gap-2">
        <Skeleton className="h-5 w-20 rounded-full" />
        <Skeleton className="h-5 w-16 rounded-full" />
      </div>
    </div>
  );
}

export function CardListSkeleton({ count = 6, columns = 3 }: CardListSkeletonProps) {
  const gridClass = columns === 3
    ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'
    : columns === 2
    ? 'grid grid-cols-1 md:grid-cols-2 gap-4'
    : 'space-y-3';

  return (
    <div className={gridClass}>
      {Array.from({ length: count }).map((_, i) => (
        <CardSkeleton key={i} />
      ))}
    </div>
  );
}

export function KanbanSkeleton({ columns = 5 }: { columns?: number }) {
  return (
    <div className="flex gap-4 overflow-hidden">
      {Array.from({ length: columns }).map((_, i) => (
        <div key={i} className="flex-shrink-0 w-72 space-y-3">
          <div className="flex items-center justify-between">
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-5 w-8 rounded-full" />
          </div>
          <div className="space-y-2">
            {Array.from({ length: 3 - Math.min(i, 2) }).map((_, j) => (
              <CardSkeleton key={j} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
