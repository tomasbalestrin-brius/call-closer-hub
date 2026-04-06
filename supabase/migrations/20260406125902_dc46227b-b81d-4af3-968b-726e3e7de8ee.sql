
-- Create whatsapp_conversations table
CREATE TABLE public.whatsapp_conversations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  closer_id UUID NOT NULL,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  phone TEXT NOT NULL,
  contact_name TEXT NOT NULL,
  contact_photo TEXT,
  last_message_at TIMESTAMPTZ DEFAULT now(),
  last_message_preview TEXT,
  unread_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (closer_id, phone)
);

-- Create whatsapp_messages table
CREATE TABLE public.whatsapp_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES public.whatsapp_conversations(id) ON DELETE CASCADE,
  message_id_external TEXT UNIQUE,
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  message_type TEXT NOT NULL DEFAULT 'text',
  content TEXT,
  media_url TEXT,
  media_metadata JSONB,
  sender_name TEXT,
  from_api BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'sent',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_whatsapp_conversations_closer_id ON public.whatsapp_conversations(closer_id);
CREATE INDEX idx_whatsapp_conversations_phone ON public.whatsapp_conversations(phone);
CREATE INDEX idx_whatsapp_conversations_client_id ON public.whatsapp_conversations(client_id);
CREATE INDEX idx_whatsapp_conversations_last_message ON public.whatsapp_conversations(last_message_at DESC);
CREATE INDEX idx_whatsapp_messages_conversation_id ON public.whatsapp_messages(conversation_id);
CREATE INDEX idx_whatsapp_messages_created_at ON public.whatsapp_messages(created_at DESC);
CREATE INDEX idx_whatsapp_messages_external_id ON public.whatsapp_messages(message_id_external);

-- Enable RLS
ALTER TABLE public.whatsapp_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;

-- RLS policies for whatsapp_conversations
CREATE POLICY "Closers can view their own conversations"
  ON public.whatsapp_conversations FOR SELECT
  USING (auth.uid() = closer_id);

CREATE POLICY "Closers can create their own conversations"
  ON public.whatsapp_conversations FOR INSERT
  WITH CHECK (auth.uid() = closer_id);

CREATE POLICY "Closers can update their own conversations"
  ON public.whatsapp_conversations FOR UPDATE
  USING (auth.uid() = closer_id);

CREATE POLICY "Admins can view all conversations"
  ON public.whatsapp_conversations FOR SELECT
  USING (has_role(auth.uid(), 'admin'::user_role));

CREATE POLICY "Service role full access conversations"
  ON public.whatsapp_conversations FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- RLS policies for whatsapp_messages
CREATE POLICY "Closers can view messages in their conversations"
  ON public.whatsapp_messages FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.whatsapp_conversations
    WHERE id = whatsapp_messages.conversation_id
    AND closer_id = auth.uid()
  ));

CREATE POLICY "Closers can insert messages in their conversations"
  ON public.whatsapp_messages FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.whatsapp_conversations
    WHERE id = whatsapp_messages.conversation_id
    AND closer_id = auth.uid()
  ));

CREATE POLICY "Admins can view all messages"
  ON public.whatsapp_messages FOR SELECT
  USING (has_role(auth.uid(), 'admin'::user_role));

CREATE POLICY "Service role full access messages"
  ON public.whatsapp_messages FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Updated_at trigger for conversations
CREATE TRIGGER update_whatsapp_conversations_updated_at
  BEFORE UPDATE ON public.whatsapp_conversations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_messages;
