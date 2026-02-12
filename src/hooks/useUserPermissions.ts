import { useUserRole } from './useUserRole';

export function useUserPermissions() {
  const { role, isAdmin, isLeader, isFinanceiro, loading } = useUserRole();
  
  const canDeleteCalls = isAdmin || isLeader;
  const canMergeCalls = true; // Todos podem juntar suas próprias calls (RLS protege)
  const canManageSquads = isAdmin;
  const canViewAllData = isAdmin || isFinanceiro;
  const canViewSquadData = isAdmin || isLeader;
  const canEditSalesValues = isAdmin || isFinanceiro;
  
  return { 
    role,
    isAdmin, 
    isLeader,
    isFinanceiro,
    canDeleteCalls, 
    canMergeCalls, 
    canManageSquads, 
    canViewAllData, 
    canViewSquadData,
    canEditSalesValues,
    loading 
  };
}
