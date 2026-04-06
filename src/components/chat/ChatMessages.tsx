import { useEffect, useRef } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { FileText, Download } from 'lucide-react';
import type { WhatsAppMessage } from '@/types/whatsapp';
import { getMediaFullUrl } from '@/types/whatsapp';

interface ChatMessagesProps {
  messages: WhatsAppMessage[];
  isLoading: boolean;
}

function MessageBubble({ msg }: { msg: WhatsAppMessage }) {
  const isOutbound = msg.direction === 'outbound';
  const time = format(new Date(msg.created_at), 'HH:mm', { locale: ptBR });

  const renderContent = () => {
    switch (msg.message_type) {
      case 'audio': {
        const audioUrl = getMediaFullUrl(msg.media_url);
        return audioUrl ? (
          <audio controls className="max-w-[240px]" preload="none">
            <source src={audioUrl} type={msg.media_metadata?.mimetype || 'audio/ogg'} />
          </audio>
        ) : (
          <span className="text-sm italic">🎵 Áudio ({msg.media_metadata?.duration}s)</span>
        );
      }
      case 'image': {
        const imgUrl = getMediaFullUrl(msg.media_url);
        return (
          <div>
            {imgUrl && (
              <img src={imgUrl} alt="Imagem" className="max-w-[280px] rounded-md mb-1" loading="lazy" />
            )}
            {msg.media_metadata?.caption && <p className="text-sm">{msg.media_metadata.caption}</p>}
          </div>
        );
      }
      case 'document': {
        const docUrl = getMediaFullUrl(msg.media_url);
        return (
          <a
            href={docUrl || '#'}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-sm hover:underline"
          >
            <FileText className="h-5 w-5 flex-shrink-0" />
            <span className="truncate">{msg.content || 'Documento'}</span>
            <Download className="h-4 w-4 flex-shrink-0" />
          </a>
        );
      }
      case 'sticker': {
        const stickerUrl = getMediaFullUrl(msg.media_url);
        return stickerUrl ? (
          <img src={stickerUrl} alt="Sticker" className="max-w-[150px]" loading="lazy" />
        ) : (
          <span className="text-sm italic">🎨 Sticker</span>
        );
      }
      case 'video': {
        const videoUrl = getMediaFullUrl(msg.media_url);
        return videoUrl ? (
          <video controls className="max-w-[280px] rounded-md" preload="none">
            <source src={videoUrl} type={msg.media_metadata?.mimetype || 'video/mp4'} />
          </video>
        ) : (
          <span className="text-sm italic">🎬 Vídeo</span>
        );
      }
      default:
        return <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>;
    }
  };

  return (
    <div className={cn('flex mb-2', isOutbound ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'max-w-[75%] rounded-2xl px-3 py-2 shadow-sm',
          isOutbound
            ? 'bg-primary text-primary-foreground rounded-br-md'
            : 'bg-muted rounded-bl-md'
        )}
      >
        {renderContent()}
        <span
          className={cn(
            'text-[10px] mt-1 block text-right',
            isOutbound ? 'text-primary-foreground/70' : 'text-muted-foreground'
          )}
        >
          {time}
        </span>
      </div>
    </div>
  );
}

export default function ChatMessages({ messages, isLoading }: ChatMessagesProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  if (isLoading) {
    return <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">Carregando mensagens...</div>;
  }

  return (
    <ScrollArea className="flex-1 px-4 py-2">
      {messages.length === 0 ? (
        <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
          Nenhuma mensagem ainda
        </div>
      ) : (
        messages.map((msg) => <MessageBubble key={msg.id} msg={msg} />)
      )}
      <div ref={bottomRef} />
    </ScrollArea>
  );
}
