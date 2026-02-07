import { useUserRoleContext } from '@/contexts/UserRoleContext';

export function useUserRole() {
  return useUserRoleContext();
}
