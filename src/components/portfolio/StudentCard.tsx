import { memo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { User, Phone, Mail, Link as LinkIcon, Flame, Users, GraduationCap, DollarSign, Target, ShoppingBag, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TICKET_LABELS } from '@/types';
import type { PortfolioStudent, TicketType } from '@/types';
import type { EnrichedStudentData } from '@/hooks/usePortfolio';

interface StudentCardProps {
  student: PortfolioStudent;
  enrichedData?: EnrichedStudentData;
  isLoadingEnriched?: boolean;
  onClick: () => void;
}

const ticketStyles: Record<TicketType, string> = {
  '29_90': 'bg-amber-500/10 text-amber-600 border-amber-500/30',
  '12k': 'bg-sky-500/10 text-sky-600 border-sky-500/30',
  '80k': 'bg-yellow-500/10 text-yellow-600 border-yellow-500/30',
};

const formatCurrency = (value: number | null | undefined) => {
  if (value === null || value === undefined) return '-';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

const StudentCard = memo(function StudentCard({ student, enrichedData, isLoadingEnriched, onClick }: StudentCardProps) {
  const isFromCRM = !!student.client_id;
  const niche = enrichedData?.niche || student.niche;
  
  return (
    <Card 
      style={{ contentVisibility: 'auto', containIntrinsicSize: '0 280px' }}
      className={cn(
        "cursor-pointer hover:border-primary/50 transition-colors",
        isFromCRM && "border-l-4 border-l-primary"
      )}
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          {/* Left: Name and Contact */}
          <div className="flex items-center gap-4 min-w-0 flex-1">
            <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
              <User className="w-5 h-5 text-muted-foreground" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-semibold text-foreground truncate">{student.name}</h3>
                {isFromCRM && (
                  <Badge variant="outline" className="text-xs gap-1 bg-primary/5 flex-shrink-0">
                    <LinkIcon className="w-3 h-3" />
                    CRM
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-3 text-sm text-muted-foreground mt-0.5 flex-wrap">
                {student.phone && (
                  <span className="flex items-center gap-1">
                    <Phone className="w-3 h-3" />
                    {student.phone}
                  </span>
                )}
                {student.email && (
                  <span className="flex items-center gap-1 truncate">
                    <Mail className="w-3 h-3" />
                    {student.email}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Center: Client Data */}
          <div className="flex items-center gap-4 lg:gap-6 flex-wrap">
            {isLoadingEnriched ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm">Carregando...</span>
              </div>
            ) : (
              <>
                {/* Revenue */}
                <div className="flex items-center gap-1.5">
                  <DollarSign className="w-4 h-4 text-green-600" />
                  <div>
                    <p className="text-xs text-muted-foreground">Faturamento</p>
                    <p className="font-medium text-sm">{formatCurrency(enrichedData?.revenue)}</p>
                  </div>
                </div>

                {/* Niche */}
                <div className="flex items-center gap-1.5">
                  <Target className="w-4 h-4 text-blue-600" />
                  <div>
                    <p className="text-xs text-muted-foreground">Nicho</p>
                    <p className="font-medium text-sm truncate max-w-[120px]">{niche || '-'}</p>
                  </div>
                </div>

                {/* Product */}
                <div className="flex items-center gap-1.5">
                  <ShoppingBag className="w-4 h-4 text-purple-600" />
                  <div>
                    <p className="text-xs text-muted-foreground">Produto</p>
                    <p className="font-medium text-sm truncate max-w-[120px]">{enrichedData?.productOffered || '-'}</p>
                  </div>
                </div>
              </>
            )}
          </div>
          
          {/* Right: Badges */}
          <div className="flex items-center gap-2 flex-wrap">
            {enrichedData?.hasIntensivo && (
              <Badge variant="outline" className="bg-orange-500/10 text-orange-600 border-orange-500/30 gap-1">
                <Flame className="w-3 h-3" />
                Intensivo
              </Badge>
            )}
            
            {enrichedData?.hasMentoria && (
              <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/30 gap-1">
                <GraduationCap className="w-3 h-3" />
                Mentoria
              </Badge>
            )}

            {(enrichedData?.indicationsCount ?? 0) > 0 && (
              <Badge variant="outline" className="bg-purple-500/10 text-purple-600 border-purple-500/30 gap-1">
                <Users className="w-3 h-3" />
                {enrichedData!.indicationsCount} {enrichedData!.indicationsCount === 1 ? 'Indicação' : 'Indicações'}
              </Badge>
            )}
            
            <Badge 
              variant="outline" 
              className={cn('font-medium', ticketStyles[student.current_ticket])}
            >
              {TICKET_LABELS[student.current_ticket]}
            </Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}, (prev, next) => {
  return prev.student.id === next.student.id
    && prev.student.current_ticket === next.student.current_ticket
    && prev.student.updated_at === next.student.updated_at
    && prev.isLoadingEnriched === next.isLoadingEnriched
    && prev.enrichedData === next.enrichedData;
});

export default StudentCard;
