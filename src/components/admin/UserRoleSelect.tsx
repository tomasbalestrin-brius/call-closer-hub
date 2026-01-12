import { useState } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { UserRole } from '@/types';

interface UserRoleSelectProps {
  userId: string;
  currentRole: UserRole;
  onRoleChange?: (newRole: UserRole) => void;
}

const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Admin',
  lider: 'Líder',
  closer: 'Closer',
};

export function UserRoleSelect({ userId, currentRole, onRoleChange }: UserRoleSelectProps) {
  const [loading, setLoading] = useState(false);

  const handleRoleChange = async (newRole: UserRole) => {
    if (newRole === currentRole) return;
    
    setLoading(true);
    try {
      // Check if user already has a role entry
      const { data: existing, error: fetchError } = await supabase
        .from('user_roles')
        .select('id')
        .eq('user_id', userId)
        .maybeSingle();

      if (fetchError) throw fetchError;

      if (existing) {
        // Update existing role
        const { error: updateError } = await supabase
          .from('user_roles')
          .update({ role: newRole })
          .eq('user_id', userId);

        if (updateError) throw updateError;
      } else {
        // Insert new role
        const { error: insertError } = await supabase
          .from('user_roles')
          .insert({ user_id: userId, role: newRole });

        if (insertError) throw insertError;
      }

      toast.success(`Role atualizada para ${ROLE_LABELS[newRole]}`);
      onRoleChange?.(newRole);
    } catch (error) {
      console.error('Error updating role:', error);
      toast.error('Erro ao atualizar role');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Select 
      value={currentRole} 
      onValueChange={(value) => handleRoleChange(value as UserRole)}
      disabled={loading}
    >
      <SelectTrigger className="w-[120px]">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="closer">Closer</SelectItem>
        <SelectItem value="lider">Líder</SelectItem>
        <SelectItem value="admin">Admin</SelectItem>
      </SelectContent>
    </Select>
  );
}
