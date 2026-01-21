import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { Json } from '@/integrations/supabase/types';

export type AuditActionType = 
  | 'goal_created' 
  | 'goal_updated' 
  | 'role_changed' 
  | 'level_changed' 
  | 'status_changed'
  | 'user_deleted';

export type AuditEntityType = 
  | 'monthly_goal' 
  | 'user_role' 
  | 'closer_level' 
  | 'closer_status'
  | 'user';

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
      const { error } = await supabase.rpc('insert_audit_log', {
        p_action_type: params.actionType,
        p_entity_type: params.entityType,
        p_entity_id: params.entityId || null,
        p_target_user_id: params.targetUserId || null,
        p_old_value: params.oldValue || null,
        p_new_value: params.newValue || null,
        p_metadata: params.metadata || null,
      });

      if (error) {
        console.error('Error logging audit action:', error);
      }
    } catch (error) {
      console.error('Error logging audit action:', error);
    }
  };

  return { logAction };
}
