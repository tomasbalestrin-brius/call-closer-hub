import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';

export type CloserLevel = 
  | 'assessor' 
  | 'executivo' 
  | 'pro' 
  | 'elite' 
  | 'especialista' 
  | 'especialista_pro' 
  | 'especialista_elite';

export const LEVEL_CONFIG: Record<CloserLevel, { label: string; color: string }> = {
  assessor: { label: 'Assessor', color: 'bg-gray-500' },
  executivo: { label: 'Executivo', color: 'bg-amber-700' },
  pro: { label: 'Pro', color: 'bg-slate-400' },
  elite: { label: 'Elite', color: 'bg-yellow-500' },
  especialista: { label: 'Especialista', color: 'bg-blue-500' },
  especialista_pro: { label: 'Especialista Pro', color: 'bg-purple-500' },
  especialista_elite: { label: 'Especialista Elite', color: 'bg-emerald-500' },
};

interface CloserLevelSelectProps {
  value: CloserLevel;
  onValueChange: (value: CloserLevel) => void;
  disabled?: boolean;
}

export function CloserLevelSelect({ value, onValueChange, disabled }: CloserLevelSelectProps) {
  return (
    <Select value={value} onValueChange={(v) => onValueChange(v as CloserLevel)} disabled={disabled}>
      <SelectTrigger className="w-[180px]">
        <SelectValue placeholder="Selecione o nível" />
      </SelectTrigger>
      <SelectContent>
        {(Object.entries(LEVEL_CONFIG) as [CloserLevel, typeof LEVEL_CONFIG[CloserLevel]][]).map(
          ([level, config]) => (
            <SelectItem key={level} value={level}>
              <div className="flex items-center gap-2">
                <Badge className={`${config.color} text-white text-xs`}>
                  {config.label}
                </Badge>
              </div>
            </SelectItem>
          )
        )}
      </SelectContent>
    </Select>
  );
}
