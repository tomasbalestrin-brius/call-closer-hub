import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Phone, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { WhatsAppConversation } from '@/types/whatsapp';

interface ConversationHeaderProps {
  conversation: WhatsAppConversation;
  onBack?: () => void;
}

export default function ConversationHeader({ conversation, onBack }: ConversationHeaderProps) {
  return (
    <div className="flex items-center gap-3 p-3 border-b border-border bg-background">
      {onBack && (
        <Button variant="ghost" size="icon" onClick={onBack} className="md:hidden">
          <ArrowLeft className="h-5 w-5" />
        </Button>
      )}
      <Avatar className="h-9 w-9">
        <AvatarImage src={conversation.contact_photo || undefined} />
        <AvatarFallback className="bg-primary/10 text-primary text-sm">
          {conversation.contact_name.slice(0, 2).toUpperCase()}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm truncate">{conversation.contact_name}</p>
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <Phone className="h-3 w-3" />
          {conversation.phone}
        </p>
      </div>
    </div>
  );
}
