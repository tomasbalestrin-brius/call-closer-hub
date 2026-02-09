import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { useQuery } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';

export type CloserLevel = 
  | 'assessor' 
  | 'executivo' 
  | 'pro' 
  | 'elite' 
  | 'especialista' 
  | 'especialista_pro' 
  | 'especialista_elite'
  | 'lider';

const LEVEL_CONFIG: Record<CloserLevel, { label: string; color: string }> = {
  assessor: { label: 'Assessor', color: 'bg-gray-500' },
  executivo: { label: 'Executivo', color: 'bg-amber-700' },
  pro: { label: 'Pro', color: 'bg-slate-400' },
  elite: { label: 'Elite', color: 'bg-yellow-500' },
  especialista: { label: 'Especialista', color: 'bg-blue-500' },
  especialista_pro: { label: 'Especialista Pro', color: 'bg-purple-500' },
  especialista_elite: { label: 'Especialista Elite', color: 'bg-emerald-500' },
  lider: { label: 'Líder', color: 'bg-pink-600' },
};

export default function DashboardHeader() {
  const { user } = useAuth();
  const { isAdmin } = useUserRole();

  const { data: profile } = useQuery({
    queryKey: ['profile', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('full_name, closer_level')
        .eq('user_id', user!.id)
        .single();

      if (error) throw error;
      return data;
    },
    staleTime: 300_000,
    enabled: !!user,
  });

  const displayName = profile?.full_name || '';
  const closerLevel = (profile?.closer_level as CloserLevel) || 'assessor';

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Bom dia';
    if (hour < 18) return 'Boa tarde';
    return 'Boa noite';
  };

  const getFirstName = () => {
    return displayName.split(' ')[0] || displayName;
  };

  const levelConfig = LEVEL_CONFIG[closerLevel] || { label: closerLevel, color: 'bg-gray-500' };

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-display font-bold">
          {getGreeting()}, {getFirstName()}!
        </h1>
        <Badge className={`${levelConfig.color} text-white`}>
          {levelConfig.label}
        </Badge>
        {isAdmin && (
          <Badge variant="outline" className="border-primary text-primary">
            Visão Geral
          </Badge>
        )}
      </div>
      <p className="text-muted-foreground text-sm">
        Confira seu desempenho e acompanhe suas metas
      </p>
    </div>
  );
}
