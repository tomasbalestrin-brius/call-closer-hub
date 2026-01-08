import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Users, 
  Trash2, 
  Loader2,
  UserPlus,
  Crown,
  User
} from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Squad {
  id: string;
  name: string;
}

interface Member {
  id: string;
  user_id: string;
  profile?: {
    full_name: string;
    phone: string | null;
  };
  role?: string;
}

interface Profile {
  id: string;
  user_id: string;
  full_name: string;
  phone: string | null;
}

interface SquadMembersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  squad: Squad;
  onMembersChange: () => void;
}

export function SquadMembersDialog({
  open,
  onOpenChange,
  squad,
  onMembersChange,
}: SquadMembersDialogProps) {
  const [members, setMembers] = useState<Member[]>([]);
  const [availableUsers, setAvailableUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    if (open) {
      fetchMembers();
      fetchAvailableUsers();
    }
  }, [open, squad.id]);

  const fetchMembers = async () => {
    try {
      const { data: membersData, error: membersError } = await supabase
        .from('squad_members')
        .select('id, user_id')
        .eq('squad_id', squad.id);

      if (membersError) throw membersError;

      // Fetch profiles for members
      const memberIds = (membersData || []).map(m => m.user_id);
      
      if (memberIds.length === 0) {
        setMembers([]);
        setLoading(false);
        return;
      }

      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('user_id, full_name, phone')
        .in('user_id', memberIds);

      if (profilesError) throw profilesError;

      // Fetch roles for members
      const { data: rolesData, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role')
        .in('user_id', memberIds);

      if (rolesError) throw rolesError;

      // Combine data
      const membersWithProfiles = (membersData || []).map(member => {
        const profile = (profilesData || []).find(p => p.user_id === member.user_id);
        const roleRecord = (rolesData || []).find(r => r.user_id === member.user_id);
        
        return {
          ...member,
          profile: profile ? {
            full_name: profile.full_name,
            phone: profile.phone
          } : undefined,
          role: roleRecord?.role
        };
      });

      setMembers(membersWithProfiles);
    } catch (error) {
      console.error('Error fetching members:', error);
      toast.error('Erro ao carregar membros');
    } finally {
      setLoading(false);
    }
  };

  const fetchAvailableUsers = async () => {
    try {
      // Get all profiles
      const { data: allProfiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, user_id, full_name, phone');

      if (profilesError) throw profilesError;

      // Get existing members of this squad
      const { data: existingMembers, error: membersError } = await supabase
        .from('squad_members')
        .select('user_id')
        .eq('squad_id', squad.id);

      if (membersError) throw membersError;

      const existingUserIds = (existingMembers || []).map(m => m.user_id);
      
      // Filter out existing members
      const available = (allProfiles || []).filter(
        p => !existingUserIds.includes(p.user_id)
      );

      setAvailableUsers(available);
    } catch (error) {
      console.error('Error fetching available users:', error);
    }
  };

  const handleAddMember = async () => {
    if (!selectedUserId) {
      toast.error('Selecione um usuário');
      return;
    }

    setAdding(true);
    try {
      const { error } = await supabase
        .from('squad_members')
        .insert({
          squad_id: squad.id,
          user_id: selectedUserId,
        });

      if (error) throw error;

      toast.success('Membro adicionado com sucesso!');
      setSelectedUserId('');
      fetchMembers();
      fetchAvailableUsers();
      onMembersChange();
    } catch (error) {
      console.error('Error adding member:', error);
      toast.error('Erro ao adicionar membro');
    } finally {
      setAdding(false);
    }
  };

  const handleRemoveMember = async (memberId: string, memberName: string) => {
    if (!confirm(`Remover ${memberName} do squad?`)) return;

    try {
      const { error } = await supabase
        .from('squad_members')
        .delete()
        .eq('id', memberId);

      if (error) throw error;

      toast.success('Membro removido com sucesso!');
      fetchMembers();
      fetchAvailableUsers();
      onMembersChange();
    } catch (error) {
      console.error('Error removing member:', error);
      toast.error('Erro ao remover membro');
    }
  };

  const getRoleBadge = (role?: string) => {
    switch (role) {
      case 'admin':
        return <Badge variant="default" className="bg-primary"><Crown className="w-3 h-3 mr-1" />Admin</Badge>;
      case 'lider':
        return <Badge variant="default" className="bg-amber-500"><Crown className="w-3 h-3 mr-1" />Líder</Badge>;
      default:
        return <Badge variant="secondary"><User className="w-3 h-3 mr-1" />Closer</Badge>;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Membros: {squad.name}
          </DialogTitle>
          <DialogDescription>
            Adicione ou remova membros do squad.
          </DialogDescription>
        </DialogHeader>

        {/* Add Member */}
        <div className="flex gap-2">
          <Select value={selectedUserId} onValueChange={setSelectedUserId}>
            <SelectTrigger className="flex-1">
              <SelectValue placeholder="Selecione um usuário" />
            </SelectTrigger>
            <SelectContent>
              {availableUsers.map((user) => (
                <SelectItem key={user.user_id} value={user.user_id}>
                  {user.full_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={handleAddMember} disabled={adding || !selectedUserId}>
            {adding ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <UserPlus className="w-4 h-4" />
            )}
          </Button>
        </div>

        {/* Members List */}
        <div className="space-y-2 max-h-[300px] overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="w-5 h-5 animate-spin text-primary" />
            </div>
          ) : members.length === 0 ? (
            <div className="text-center py-4 text-muted-foreground text-sm">
              Nenhum membro neste squad
            </div>
          ) : (
            members.map((member) => (
              <div
                key={member.id}
                className="flex items-center justify-between p-3 rounded-lg border bg-card"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <User className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">
                      {member.profile?.full_name || 'Usuário'}
                    </p>
                    {getRoleBadge(member.role)}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleRemoveMember(member.id, member.profile?.full_name || 'Usuário')}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
