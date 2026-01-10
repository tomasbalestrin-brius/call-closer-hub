import { ClientTag } from '@/types';
import { cn } from '@/lib/utils';
import { Tag, Star, Flame, Heart, Zap, AlertCircle, Clock, CheckCircle } from 'lucide-react';

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  tag: Tag,
  star: Star,
  flame: Flame,
  heart: Heart,
  zap: Zap,
  alert: AlertCircle,
  clock: Clock,
  check: CheckCircle,
};

interface TagBadgeProps {
  tag: ClientTag;
  size?: 'sm' | 'md';
  onRemove?: () => void;
  className?: string;
}

export default function TagBadge({ tag, size = 'sm', onRemove, className }: TagBadgeProps) {
  const IconComponent = ICON_MAP[tag.icon] || Tag;
  
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full font-medium transition-colors",
        size === 'sm' && "text-[10px] px-1.5 py-0.5",
        size === 'md' && "text-xs px-2 py-1",
        className
      )}
      style={{ 
        backgroundColor: `${tag.color}20`,
        color: tag.color,
        borderColor: `${tag.color}40`,
        borderWidth: 1
      }}
    >
      <IconComponent className={cn(size === 'sm' ? "w-2.5 h-2.5" : "w-3 h-3")} />
      <span>{tag.name}</span>
      {onRemove && (
        <button
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          className="ml-0.5 hover:opacity-70"
        >
          ×
        </button>
      )}
    </span>
  );
}
