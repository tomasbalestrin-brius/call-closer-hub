import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BookOpen } from 'lucide-react';

interface Verse {
  verse_text: string;
  reference: string;
  category: string;
}

function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}

export default function DailyVerse() {
  const { user } = useAuth();

  const { data: verse, isLoading: loading } = useQuery({
    queryKey: ['daily-verse', user?.id],
    queryFn: async (): Promise<Verse | null> => {
      if (!user) return null;

      const today = new Date().toISOString().split('T')[0];
      const hashInput = `${user.id}${today}`;
      const hash = hashCode(hashInput);
      const verseIndex = (hash % 365) + 1;

      const { data, error } = await supabase
        .from('daily_verses')
        .select('verse_text, reference, category')
        .eq('day_of_year', verseIndex)
        .single();

      if (error) throw error;
      return data;
    },
    staleTime: 24 * 60 * 60 * 1000, // 24h
    enabled: !!user,
  });

  if (loading) {
    return (
      <Card className="bg-gradient-to-r from-primary/5 to-primary/10 border-primary/20">
        <CardContent className="py-6">
          <div className="animate-pulse space-y-3">
            <div className="h-4 bg-muted rounded w-3/4" />
            <div className="h-4 bg-muted rounded w-1/2" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!verse) {
    return null;
  }

  return (
    <Card className="bg-gradient-to-r from-primary/5 to-primary/10 border-primary/20">
      <CardContent className="py-6">
        <div className="flex items-start gap-4">
          <div className="p-2 rounded-full bg-primary/10">
            <BookOpen className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-muted-foreground">Versículo do Dia</span>
              <Badge variant="secondary" className="text-xs">
                {verse.category}
              </Badge>
            </div>
            <blockquote className="text-base italic text-foreground leading-relaxed">
              "{verse.verse_text}"
            </blockquote>
            <p className="text-sm font-semibold text-primary">
              — {verse.reference}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
