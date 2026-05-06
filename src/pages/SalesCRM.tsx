import { Navigate } from 'react-router-dom';
import MainLayout from '@/components/layout/MainLayout';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { SalesKanban } from '@/components/sales/SalesKanban';
import { TrendingUp } from 'lucide-react';

export default function SalesCRM() {
  const { user, loading } = useAuth();
  const { isIntensivo, isLeader, isAdmin, isFinanceiro, loading: roleLoading } = useUserRole();

  if (loading || roleLoading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      </MainLayout>
    );
  }
  if (!user) return <Navigate to="/auth" replace />;
  // Permitido: closer, admin, financeiro, líder. Bloqueia apenas intensivo.
  if (isIntensivo) return <Navigate to="/" replace />;

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-emerald-500/10">
            <TrendingUp className="w-6 h-6 text-emerald-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">CRM Vendas</h1>
            <p className="text-sm text-muted-foreground">
              Acompanhe o pós-venda — contratos, recebimentos e indicações
            </p>
          </div>
        </div>
        <SalesKanban />
      </div>
    </MainLayout>
  );
}
