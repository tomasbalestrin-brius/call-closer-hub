import { useUserRole } from './useUserRole';

export function useUserPermissions() {
  const { role, isAdmin, isLeader, loading } = useUserRole();
  
  const canDeleteCalls = isAdmin || isLeader;
  const canMergeCalls = isAdmin || isLeader;
  const canManageSquads = isAdmin;
  const canViewAllData = isAdmin;
  const canViewSquadData = isAdmin || isLeader;
  
  return { 
    role,
    isAdmin, 
    isLeader,
    canDeleteCalls, 
    canMergeCalls, 
    canManageSquads, 
    canViewAllData, 
    canViewSquadData,
    loading 
  };
}
