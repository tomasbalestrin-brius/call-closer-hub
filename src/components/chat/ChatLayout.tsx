import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { MessageCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useConversations } from '@/hooks/useConversations';
import { useWhatsAppMessages } from '@/hooks/useWhatsAppMessages';
import ConversationList from './ConversationList';
import ConversationHeader from './ConversationHeader';
import ChatMessages from './ChatMessages';
import ChatInput from './ChatInput';
import type { WhatsAppConversation } from '@/types/whatsapp';

export default function ChatLayout() {
  const [searchParams] = useSearchParams();
  const [selected, setSelected] = useState<WhatsAppConversation | null>(null);
  const { data: conversations = [], isLoading: loadingConvos } = useConversations();
  const { data: messages = [], isLoading: loadingMessages, sendMessage } = useWhatsAppMessages(selected?.id || null);

  const handleSelect = (conv: WhatsAppConversation) => {
    setSelected(conv);
  };

  const handleSend = (message: string) => {
    sendMessage.mutate(message);
  };

  return (
    <div className="flex h-[calc(100vh-4rem)] bg-background rounded-lg border border-border overflow-hidden">
      {/* Conversation List */}
      <div className={cn(
        'w-full md:w-80 lg:w-96 flex-shrink-0',
        selected ? 'hidden md:flex md:flex-col' : 'flex flex-col'
      )}>
        <ConversationList
          conversations={conversations}
          selectedId={selected?.id || null}
          onSelect={handleSelect}
          isLoading={loadingConvos}
        />
      </div>

      {/* Chat Area */}
      <div className={cn(
        'flex-1 flex flex-col',
        !selected ? 'hidden md:flex' : 'flex'
      )}>
        {selected ? (
          <>
            <ConversationHeader
              conversation={selected}
              onBack={() => setSelected(null)}
            />
            <ChatMessages messages={messages} isLoading={loadingMessages} />
            <ChatInput
              onSend={handleSend}
              isSending={sendMessage.isPending}
            />
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-3">
            <MessageCircle className="h-12 w-12" />
            <p className="text-sm">Selecione uma conversa para começar</p>
          </div>
        )}
      </div>
    </div>
  );
}
