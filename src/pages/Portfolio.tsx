import { useState, useMemo } from 'react';
import MainLayout from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Search } from 'lucide-react';
import AscensionMetrics from '@/components/portfolio/AscensionMetrics';
import TicketCounter from '@/components/portfolio/TicketCounter';
import ActivityMetrics from '@/components/portfolio/ActivityMetrics';
import IndicationMetrics from '@/components/portfolio/IndicationMetrics';
import PortfolioFilters from '@/components/portfolio/PortfolioFilters';
import StudentList from '@/components/portfolio/StudentList';
import NewStudentDialog from '@/components/portfolio/NewStudentDialog';
import { usePortfolioStudents, useClientsMetrics, useStudentActivities, useStudentIndications } from '@/hooks/usePortfolio';
import type { TicketType } from '@/types';

export interface PortfolioFiltersState {
  ticketFilter: TicketType | 'all';
  activityFilter: 'all' | 'with_activities' | 'without_activities' | 'intensivo' | 'mentoria' | 'evento';
  indicationFilter: 'all' | 'with_indications' | 'without_indications';
  dateRange: { from: Date | undefined; to: Date | undefined };
}

export default function Portfolio() {
  const [searchQuery, setSearchQuery] = useState('');
  const [isNewStudentOpen, setIsNewStudentOpen] = useState(false);
  const [filters, setFilters] = useState<PortfolioFiltersState>({
    ticketFilter: 'all',
    activityFilter: 'all',
    indicationFilter: 'all',
    dateRange: { from: undefined, to: undefined },
  });
  
  const { data: students, isLoading } = usePortfolioStudents();
  const { data: activities } = useStudentActivities();
  const { data: indications } = useStudentIndications();
  const metrics = useClientsMetrics(); // Métricas baseadas em TODOS os clientes
  
  // Filter students based on search and filters
  const filteredStudents = useMemo(() => {
    if (!students) return [];
    
    return students.filter(student => {
      // Search filter
      const matchesSearch = searchQuery === '' || 
        student.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        student.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        student.phone?.includes(searchQuery);
      
      if (!matchesSearch) return false;
      
      // Ticket filter
      if (filters.ticketFilter !== 'all' && student.current_ticket !== filters.ticketFilter) {
        return false;
      }
      
      // Date filter
      if (filters.dateRange.from) {
        const entryDate = new Date(student.entry_date);
        if (entryDate < filters.dateRange.from) return false;
      }
      if (filters.dateRange.to) {
        const entryDate = new Date(student.entry_date);
        if (entryDate > filters.dateRange.to) return false;
      }
      
      // Activity filter
      if (filters.activityFilter !== 'all') {
        const studentActivities = activities?.filter(a => a.student_id === student.id) || [];
        
        if (filters.activityFilter === 'with_activities' && studentActivities.length === 0) return false;
        if (filters.activityFilter === 'without_activities' && studentActivities.length > 0) return false;
        if (['intensivo', 'mentoria', 'evento'].includes(filters.activityFilter)) {
          const hasType = studentActivities.some(a => a.activity_type === filters.activityFilter);
          if (!hasType) return false;
        }
      }
      
      // Indication filter
      if (filters.indicationFilter !== 'all') {
        const studentIndications = indications?.filter(i => i.student_id === student.id) || [];
        
        if (filters.indicationFilter === 'with_indications' && studentIndications.length === 0) return false;
        if (filters.indicationFilter === 'without_indications' && studentIndications.length > 0) return false;
      }
      
      return true;
    });
  }, [students, searchQuery, filters, activities, indications]);
  
  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-display font-bold text-foreground">Carteira</h1>
            <p className="text-muted-foreground mt-1">Acompanhe seus alunos pós-venda</p>
          </div>
          <Button onClick={() => setIsNewStudentOpen(true)} className="gap-2">
            <Plus className="w-4 h-4" />
            Novo Aluno
          </Button>
        </div>
        
        {/* Metrics Row 1: Ascension */}
        <AscensionMetrics metrics={metrics} />
        
        {/* Metrics Row 2: Ticket Counter */}
        <TicketCounter metrics={metrics} />
        
        {/* Metrics Row 3: Activities */}
        <ActivityMetrics metrics={metrics} />
        
        {/* Metrics Row 4: Indications */}
        <IndicationMetrics metrics={metrics} />
        
        {/* Filters */}
        <PortfolioFilters filters={filters} onFiltersChange={setFilters} />
        
        {/* Search + List */}
        <div className="space-y-4">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar aluno por nome, email ou telefone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          
          <StudentList students={filteredStudents} isLoading={isLoading} />
        </div>
        
        {/* Dialogs */}
        <NewStudentDialog open={isNewStudentOpen} onOpenChange={setIsNewStudentOpen} />
      </div>
    </MainLayout>
  );
}
