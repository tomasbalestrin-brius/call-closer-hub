import { Call, CallStatus } from '@/types';
import { Phone, Clock, PhoneForwarded, FileText, CheckCircle2, XCircle } from 'lucide-react';

interface CallStatsBarProps {
  calls: Call[];
  onStatusFilter: (status: CallStatus | 'all') => void;
  activeStatus: CallStatus | 'all';
}

const stats = [
  { status: 'all' as const, label: 'Total', icon: Phone, color: 'bg-muted text-muted-foreground' },
  { status: 'pendente' as const, label: 'Pendentes', icon: Clock, color: 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400' },
  { status: 'follow_up' as const, label: 'Follow-up', icon: PhoneForwarded, color: 'bg-blue-500/10 text-blue-600 dark:text-blue-400' },
  { status: 'proposta_enviada' as const, label: 'Propostas', icon: FileText, color: 'bg-purple-500/10 text-purple-600 dark:text-purple-400' },
  { status: 'vendido' as const, label: 'Vendidas', icon: CheckCircle2, color: 'bg-green-500/10 text-green-600 dark:text-green-400' },
  { status: 'perdido' as const, label: 'Perdidas', icon: XCircle, color: 'bg-red-500/10 text-red-600 dark:text-red-400' },
];

export default function CallStatsBar({ calls, onStatusFilter, activeStatus }: CallStatsBarProps) {
  const getCount = (status: CallStatus | 'all') => {
    if (status === 'all') return calls.length;
    return calls.filter(call => call.status === status).length;
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
