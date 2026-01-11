import { IntensiveLead, IntensiveLeadStatus, INTENSIVE_COLUMNS } from '@/types/intensivo';
import { 
  MessageSquare, 
  Brain, 
  Send, 
  Clock, 
  CheckCircle, 
  Ticket, 
  Flame, 
  UserCheck, 
  UserX, 
  XCircle, 
  Calendar,
  Users
} from 'lucide-react';

interface IntensiveStatsBarProps {
  leads: IntensiveLead[];
  onStatusFilter: (status: IntensiveLeadStatus | 'all') => void;
  activeStatus: IntensiveLeadStatus | 'all';
}

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  MessageSquare,
  Brain,
  Send,
  Clock,
  CheckCircle,
  Ticket,
  Flame,
  UserCheck,
  UserX,
  XCircle,
  Calendar,
};

// Group stats for better visualization
const stats = [
  { status: 'all' as const, label: 'Total', icon: Users, color: 'bg-muted text-muted-foreground' },
  { status: 'abordagem_inicial' as IntensiveLeadStatus, label: 'Abordagem', icon: MessageSquare, color: 'bg-blue-500/10 text-blue-600 dark:text-blue-400' },
  { status: 'confirmados' as IntensiveLeadStatus, label: 'Confirmados', icon: CheckCircle, color: 'bg-green-500/10 text-green-600 dark:text-green-400' },
  { status: 'ingresso_retirado' as IntensiveLeadStatus, label: 'Ingressos', icon: Ticket, color: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' },
  { status: 'compareceram' as IntensiveLeadStatus, label: 'Compareceram', icon: UserCheck, color: 'bg-green-700/10 text-green-700 dark:text-green-500' },
  { status: 'nao_compareceram' as IntensiveLeadStatus, label: 'Não Comparec.', icon: UserX, color: 'bg-red-500/10 text-red-600 dark:text-red-400' },
  { status: 'sem_interesse' as IntensiveLeadStatus, label: 'Sem Interesse', icon: XCircle, color: 'bg-gray-500/10 text-gray-600 dark:text-gray-400' },
];

export function IntensiveStatsBar({ leads, onStatusFilter, activeStatus }: IntensiveStatsBarProps) {
  const getCount = (status: IntensiveLeadStatus | 'all') => {
    if (status === 'all') return leads.length;
    return leads.filter(lead => lead.status === status).length;
  };

  return (
    <div className="flex flex-wrap gap-2">
      {stats.map(({ status, label, icon: Icon, color }) => {
        const count = getCount(status);
        const isActive = activeStatus === status;
        
        return (
          <button
            key={status}
            onClick={() => onStatusFilter(status)}
            className={`
              flex items-center gap-2 px-3 py-2 rounded-lg transition-all
              ${color}
              ${isActive ? 'ring-2 ring-primary ring-offset-2 ring-offset-background' : 'hover:opacity-80'}
            `}
          >
            <Icon className="w-4 h-4" />
            <span className="font-medium">{label}</span>
            <span className="font-bold">{count}</span>
          </button>
        );
      })}
    </div>
  );
}
