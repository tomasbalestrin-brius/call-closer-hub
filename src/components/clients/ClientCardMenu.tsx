import { useState } from 'react';
import { MoreVertical, Flame, Edit, Calendar, Copy, Phone, Send, Tags } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Client } from '@/types';
import TagSelector from './tags/TagSelector';

interface ClientCardMenuProps {
  client: Client;
  onUpdate: () => void;
  onIndicateClick?: () => void;
  onEditClick?: () => void;
  onFollowupClick?: () => void;
}

export default function ClientCardMenu({ 
  client, 
  onUpdate, 
  onIndicateClick,
  onEditClick,
  onFollowupClick 
}: ClientCardMenuProps) {
  const [loading, setLoading] = useState(false);
  const [tagSelectorOpen, setTagSelectorOpen] = useState(false);

  const handleToggleSuperHot = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setLoading(true);
    
    try {
      const { error } = await supabase
        .from('clients')
        .update({ is_super_hot: !client.is_super_hot })
        .eq('id', client.id);

      if (error) throw error;
      
      toast.success(client.is_super_hot ? 'Tag Super Quente removida!' : 'Marcado como Super Quente! 🔥');
      onUpdate();
    } catch (error) {
      console.error('Error toggling super hot:', error);
      toast.error('Erro ao atualizar tag');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyPhone = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (client.phone) {
      navigator.clipboard.writeText(client.phone);
      toast.success('Telefone copiado!');
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
          <DropdownMenuItem onClick={handleToggleSuperHot} disabled={loading}>
            <Flame className={`h-4 w-4 mr-2 ${client.is_super_hot ? 'text-orange-500' : ''}`} />
            {client.is_super_hot ? 'Remover Super Quente' : 'Marcar Super Quente 🔥'}
          </DropdownMenuItem>
          
          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setTagSelectorOpen(true); }}>
            <Tags className="h-4 w-4 mr-2" />
            Gerenciar Tags
          </DropdownMenuItem>
          
          <DropdownMenuSeparator />
          
          {onEditClick && (
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEditClick(); }}>
              <Edit className="h-4 w-4 mr-2" />
              Editar Cliente
            </DropdownMenuItem>
          )}
          
          {onFollowupClick && (
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onFollowupClick(); }}>
              <Calendar className="h-4 w-4 mr-2" />
              Agendar Follow-up
            </DropdownMenuItem>
          )}
          
          {onIndicateClick && (
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onIndicateClick(); }}>
              <Send className="h-4 w-4 mr-2" />
              Indicar
            </DropdownMenuItem>
          )}
          
          <DropdownMenuSeparator />
          
          {client.phone && (
            <>
              <DropdownMenuItem onClick={handleCopyPhone}>
                <Copy className="h-4 w-4 mr-2" />
                Copiar Telefone
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <a 
                  href={`https://wa.me/${client.phone.replace(/\D/g, '')}`} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Phone className="h-4 w-4 mr-2" />
                  Abrir WhatsApp
                </a>
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Tag Selector Dialog */}
      {tagSelectorOpen && (
        <div onClick={(e) => e.stopPropagation()}>
          <TagSelector 
            clientId={client.id} 
            onTagsChange={onUpdate}
            open={tagSelectorOpen}
            onOpenChange={setTagSelectorOpen}
          />
        </div>
      )}
    </>
  );
}
