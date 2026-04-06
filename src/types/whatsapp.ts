export interface WhatsAppConversation {
  id: string;
  closer_id: string;
  client_id: string | null;
  phone: string;
  contact_name: string;
  contact_photo: string | null;
  last_message_at: string;
  last_message_preview: string | null;
  unread_count: number;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface WhatsAppMessage {
  id: string;
  conversation_id: string;
  message_id_external: string | null;
  direction: 'inbound' | 'outbound';
  message_type: string;
  content: string | null;
  media_url: string | null;
  media_metadata: Record<string, any> | null;
  sender_name: string | null;
  from_api: boolean;
  status: string;
  created_at: string;
}

export type MessageType = 'text' | 'audio' | 'image' | 'document' | 'sticker' | 'video' | 'location' | 'contact';

export function getMediaFullUrl(urlField: string | null): string | null {
  if (!urlField) return null;
  if (urlField.startsWith('http://') || urlField.startsWith('https://')) {
    return urlField;
  }
  return `https://whatsapp-avatar.s3.sa-east-1.amazonaws.com/${urlField}`;
}
