import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { Json } from '@/integrations/supabase/types';

export type AuditActionType = 
  | 'goal_created' 
  | 'goal_updated' 
  | 'role_changed' 
  | 'level_changed' 
  | 'status_changed';

export type AuditEntityType = 
  | 'monthly_goal' 
  | 'user_role' 
  | 'closer_level' 
  | 'closer_status';

interface AuditLogParams {
  actionType: AuditActionType;
  entityType: AuditEntityType;
  targetUserId?: string;
  entityId?: string;
  oldValue?: Json;
  newValue?: Json;
  metadata?: Json;
}

export function useAuditLog() {
  const { user } = useAuth();

  const logAction = async (params: AuditLogParams) => {
    if (!user) return;

    try {
      const { error } = await supabase.from('admin_audit_logs').insert([{
        action_type: params.actionType,
        performed_by: user.id,
        target_user_id: params.targetUserId || null,
        entity_type: params.entityType,
        entity_id: params.entityId || null,
        old_value: params.oldValue || null,
        new_value: params.newValue || null,
        metadata: params.metadata || null,
      }]);

      if (error) {
        console.error('Error logging audit action:', error);
      }
    } catch (error) {
      console.error('Error logging audit action:', error);
    }
  };

  return { logAction };
}
