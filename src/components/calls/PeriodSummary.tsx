import { useState, useMemo } from 'react';
import { Call } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, ChevronUp, BarChart3, CheckCircle2, AlertTriangle, Phone, Star, Info } from 'lucide-react';
import { DateRangePicker } from '@/components/dashboard/DateRangePicker';
import { DateRange } from 'react-day-picker';

interface PeriodSummaryProps {
  calls: Call[];
  dateRange: DateRange | undefined;
  onDateRangeChange: (range: DateRange | undefined) => void;
}

interface AggregatedItem {
  text: string;
  count: number;
}

export default function PeriodSummary({ calls, dateRange, onDateRangeChange }: PeriodSummaryProps) {
  const [isOpen, setIsOpen] = useState(true);

  const summary = useMemo(() => {
    // Filter calls with AI analysis
    const callsWithAnalysis = calls.filter(c => c.analyzed_at);
    
    if (callsWithAnalysis.length === 0) {
      return {
        totalCalls: calls.length,
        analyzedCalls: 0,
        averageScore: 0,
        topWins: [] as AggregatedItem[],
        topErrors: [] as AggregatedItem[],
      };
    }

    // Calculate average score
    const scoresArray = callsWithAnalysis
      .filter(c => c.score !== null)
      .map(c => c.score as number);
    const averageScore = scoresArray.length > 0
      ? scoresArray.reduce((a, b) => a + b, 0) / scoresArray.length
      : 0;

    // Aggregate wins
    const winsCount = new Map<string, number>();
    callsWithAnalysis.forEach(call => {
      call.main_wins?.forEach(win => {
        const normalizedWin = win.trim();
        if (normalizedWin) {
          winsCount.set(normalizedWin, (winsCount.get(normalizedWin) || 0) + 1);
        }
      });
    });

    // Aggregate errors
    const errorsCount = new Map<string, number>();
    callsWithAnalysis.forEach(call => {
      call.main_errors?.forEach(error => {
        const normalizedError = error.trim();
        if (normalizedError) {
          errorsCount.set(normalizedError, (errorsCount.get(normalizedError) || 0) + 1);
        }
      });
    });

    // Sort and get top 5
    const topWins = [...winsCount.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([text, count]) => ({ text, count }));

    const topErrors = [...errorsCount.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([text, count]) => ({ text, count }));

    return {
      totalCalls: calls.length,
      analyzedCalls: callsWithAnalysis.length,
      averageScore: Math.round(averageScore * 10) / 10,
      topWins,
      topErrors,
    };
  }, [calls]);

  // Don't render if no calls
  if (calls.length === 0) {
    return null;
  }

  const hasAnalyzedCalls = summary.analyzedCalls > 0;
  const isSmallSample = summary.analyzedCalls > 0 && summary.analyzedCalls < 3;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
        <CardHeader className="py-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <CollapsibleTrigger asChild>
              <div className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity">
                <BarChart3 className="w-5 h-5 text-primary" />
                <CardTitle className="text-lg font-semibold">Resumo do Período</CardTitle>
                <Badge variant="secondary" className="ml-2">
                  {summary.totalCalls} calls
                </Badge>
                {isOpen ? (
                  <ChevronUp className="w-5 h-5 text-muted-foreground ml-2" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-muted-foreground ml-2" />
                )}
              </div>
            </CollapsibleTrigger>
            <div onClick={(e) => e.stopPropagation()}>
              <DateRangePicker 
                dateRange={dateRange}
                onDateRangeChange={onDateRangeChange}
              />
            </div>
          </div>
        </CardHeader>

        <CollapsibleContent>
          <CardContent className="pt-0 pb-4">
            {/* Small sample warning */}
            {isSmallSample && (
              <div className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400 mb-4 p-2 bg-amber-500/10 rounded-lg">
                <Info className="w-4 h-4 flex-shrink-0" />
                <span>Amostra pequena ({summary.analyzedCalls} calls analisadas). Os dados podem não ser representativos.</span>
              </div>
            )}

            {/* Stats Row */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
              <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Phone className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Total de Calls</p>
                  <p className="text-xl font-bold">{summary.totalCalls}</p>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                <div className="p-2 bg-amber-500/10 rounded-lg">
                  <Star className="w-4 h-4 text-amber-500" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Nota Média</p>
                  <p className="text-xl font-bold">
                    {hasAnalyzedCalls ? `${summary.averageScore}/10` : '-'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg col-span-2 sm:col-span-1">
                <div className="p-2 bg-blue-500/10 rounded-lg">
                  <BarChart3 className="w-4 h-4 text-blue-500" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Calls Analisadas</p>
                  <p className="text-xl font-bold">
                    {summary.analyzedCalls}
                    <span className="text-sm font-normal text-muted-foreground ml-1">
                      ({summary.totalCalls > 0 ? Math.round((summary.analyzedCalls / summary.totalCalls) * 100) : 0}%)
                    </span>
                  </p>
                </div>
              </div>
            </div>

            {/* Wins and Errors */}
            {hasAnalyzedCalls ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Top Wins */}
                <div className="p-4 bg-green-500/5 border border-green-500/20 rounded-lg">
                  <div className="flex items-center gap-2 mb-3">
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                    <h4 className="font-semibold text-green-600 dark:text-green-400">Maiores Acertos</h4>
                  </div>
                  {summary.topWins.length > 0 ? (
                    <ul className="space-y-2">
                      {summary.topWins.map((item, index) => (
                        <li key={index} className="flex items-start justify-between gap-2">
                          <span className="text-sm text-foreground/80 leading-tight flex-1">
                            • {item.text}
                          </span>
                          <Badge variant="outline" className="text-green-600 border-green-500/30 text-xs flex-shrink-0">
                            {item.count}x
                          </Badge>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-muted-foreground">Nenhum acerto identificado</p>
                  )}
                </div>

                {/* Top Errors */}
                <div className="p-4 bg-amber-500/5 border border-amber-500/20 rounded-lg">
                  <div className="flex items-center gap-2 mb-3">
                    <AlertTriangle className="w-4 h-4 text-amber-500" />
                    <h4 className="font-semibold text-amber-600 dark:text-amber-400">Maiores Erros</h4>
                  </div>
                  {summary.topErrors.length > 0 ? (
                    <ul className="space-y-2">
                      {summary.topErrors.map((item, index) => (
                        <li key={index} className="flex items-start justify-between gap-2">
                          <span className="text-sm text-foreground/80 leading-tight flex-1">
                            • {item.text}
                          </span>
                          <Badge variant="outline" className="text-amber-600 border-amber-500/30 text-xs flex-shrink-0">
                            {item.count}x
                          </Badge>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-muted-foreground">Nenhum erro identificado</p>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-center py-6 bg-muted/30 rounded-lg">
                <BarChart3 className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-muted-foreground">
                  Nenhuma call com análise de IA no período selecionado
                </p>
                <p className="text-sm text-muted-foreground/70 mt-1">
                  Importe transcrições do Google Drive para gerar análises
                </p>
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
