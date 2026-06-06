import { useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { toast } from 'sonner';
import { exportLeadsForCloser } from '@/lib/exportLeadsCsv';

interface ExportLeadsButtonProps {
  closerId: string;
  closerName: string;
}

export function ExportLeadsButton({ closerId, closerName }: ExportLeadsButtonProps) {
  const [loading, setLoading] = useState(false);

  const handleExport = async () => {
    setLoading(true);
    try {
      const count = await exportLeadsForCloser(closerId, closerName);
      if (count === 0) {
        toast.info(`${closerName} não possui leads para exportar`);
      } else {
        toast.success(`${count} lead(s) exportado(s) de ${closerName}`);
      }
    } catch (err) {
      console.error('Export leads error:', err);
      toast.error(err instanceof Error ? err.message : 'Erro ao exportar leads');
    } finally {
      setLoading(false);
    }
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
            disabled={loading}
            aria-label={`Exportar leads de ${closerName}`}
            className="min-w-[112px]"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            {loading ? 'Exportando' : 'Exportar'}
          </Button>
        </TooltipTrigger>
        <TooltipContent>Exportar leads (CSV)</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
