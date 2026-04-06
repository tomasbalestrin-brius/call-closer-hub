import { useState, useCallback } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { 
  LayoutDashboard, 
  Phone, 
  Users, 
  Settings, 
  LogOut,
  ChevronLeft,
  ChevronRight,
  Bell,
  Shield,
  BarChart3,
  Briefcase,
  Flame,
  MessageCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { useQueryClient } from '@tanstack/react-query';
import { useConversations } from '@/hooks/useConversations';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
const logo = "/logo-bethel-closer.png";

const baseNavigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Calls', href: '/calls', icon: Phone },
  { name: 'CRM Calls', href: '/clients', icon: Users },
  { name: 'CRM Intensivo', href: '/intensivo-crm', icon: Flame },
  { name: 'Carteira', href: '/portfolio', icon: Briefcase },
  { name: 'Chat', href: '/chat', icon: MessageCircle },
  { name: 'Notificações', href: '/notifications', icon: Bell },
  { name: 'Configurações', href: '/settings', icon: Settings },
];

const closerOnlyItems = ['/clients', '/intensivo-crm'];

const getBaseNavigation = (isAdmin: boolean) => {
  if (isAdmin) {
    return baseNavigation.filter(item => !closerOnlyItems.includes(item.href));
  }
  return baseNavigation;
};

const leaderNavigation = [
  { name: 'Relatórios', href: '/squad-reports', icon: BarChart3 },
  { name: 'Ver Time', href: '/squad-view', icon: Users },
];

const adminNavigation = [
  { name: 'Admin', href: '/admin', icon: Shield },
];

// Prefetch configs per route
const prefetchConfigs: Record<string, (userId: string) => { queryKey: string[]; queryFn: () => Promise<any> }> = {
  '/calls': (userId) => ({
    queryKey: ['calls', userId],
    queryFn: async () => {
      const { data } = await supabase
        .from('calls')
        .select('id, closer_id, client_id, client_name, call_date, call_time, duration_minutes, status, score, product, sale_value, entry_value, main_errors, main_wins, loss_point, niche, main_pain, main_difficulty, ai_summary, call_conclusion, technical_analysis, merged_with_call_id, created_at, updated_at, analyzed_at, company_name, notes, observation, deleted_at, deleted_by, next_contact_date, google_doc_id, source_file_id, content_hash, has_partner, consciousness_level, decision_reason, lead_classification, closer_classification, analysis_metadata, analysis_quality_score')
        .eq('closer_id', userId)
        .is('merged_with_call_id', null)
        .order('call_date', { ascending: false });
      return data || [];
    },
  }),
  '/clients': (userId) => ({
    queryKey: ['clients', userId],
    queryFn: async () => {
      const { data } = await supabase
        .from('clients')
        .select('id, closer_id, name, email, phone, company, niche, status, source, revenue, has_partner, main_difficulty, main_pain, notes, negotiation_notes, sale_notes, entry_value, sale_value, followup_date, contract_validity, is_sold, sold_at, is_from_indication, indication_source_id, is_super_hot, product_offered, sdr_name, funnel_source, status_changed_at, created_at, updated_at, instagram, data_completed_at, name_normalized')
        .eq('closer_id', userId)
        .order('created_at', { ascending: false });
      return data || [];
    },
  }),
  '/portfolio': (userId) => ({
    queryKey: ['portfolio-students', userId],
    queryFn: async () => {
      const { data } = await supabase
        .from('portfolio_students')
        .select('id, client_id, closer_id, name, phone, email, niche, notes, current_ticket, entry_date, created_at, updated_at')
        .order('created_at', { ascending: false });
      return data || [];
    },
  }),
};

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const { user, signOut } = useAuth();
  const { isAdmin, isLeader, isFinanceiro } = useUserRole();
  const queryClient = useQueryClient();
  const { totalUnread } = useConversations();

  const navigation = [
    ...getBaseNavigation(isAdmin),
    ...(isAdmin || isLeader ? leaderNavigation : []),
    ...(isAdmin || isFinanceiro ? adminNavigation : []),
  ];

  const handleSignOut = async () => {
    const { error } = await signOut();
    if (error) {
      toast.error('Erro ao sair');
    } else {
      toast.success('Até logo!');
    }
  };

  const handlePrefetch = useCallback((href: string) => {
    if (!user?.id) return;
    const config = prefetchConfigs[href];
    if (config) {
      const { queryKey, queryFn } = config(user.id);
      queryClient.prefetchQuery({ queryKey, queryFn, staleTime: 30_000 });
    }
  }, [user?.id, queryClient]);

  return (
    <aside
      className={cn(
        'fixed left-0 top-0 z-40 h-screen bg-sidebar transition-all duration-300',
        collapsed ? 'w-16' : 'w-64'
      )}
    >
      <div className="flex h-full flex-col">
        {/* Logo */}
        <div className="flex h-16 items-center justify-between px-4 border-b border-sidebar-border">
          {!collapsed && (
            <div className="flex items-center gap-3">
              <img src={logo} alt="Bethel Closer" className="h-8 w-8 object-contain" />
              <span className="font-display font-bold text-sidebar-foreground">Bethel Closer</span>
            </div>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setCollapsed(!collapsed)}
            className="text-sidebar-foreground hover:bg-sidebar-accent"
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </Button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 px-2 py-4">
          {navigation.map((item) => {
            const isActive = location.pathname === item.href;
            return (
              <NavLink
                key={item.name}
                to={item.href}
                onMouseEnter={() => handlePrefetch(item.href)}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-sidebar-primary text-sidebar-primary-foreground'
                    : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground'
                )}
              >
                <item.icon className="w-5 h-5 flex-shrink-0" />
                {!collapsed && <span>{item.name}</span>}
              </NavLink>
            );
          })}
        </nav>

        {/* Logout */}
        <div className="border-t border-sidebar-border p-2">
          <Button
            variant="ghost"
            onClick={handleSignOut}
            className={cn(
              'w-full justify-start gap-3 text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground',
              collapsed && 'justify-center px-0'
            )}
          >
            <LogOut className="w-5 h-5" />
            {!collapsed && <span>Sair</span>}
          </Button>
        </div>
      </div>
    </aside>
  );
}
