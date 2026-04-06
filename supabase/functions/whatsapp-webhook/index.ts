import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function getMediaUrl(urlField: string | null | undefined): string | null {
  if (!urlField) return null;
  if (urlField.startsWith("http://") || urlField.startsWith("https://")) return urlField;
  return `https://whatsapp-avatar.s3.sa-east-1.amazonaws.com/${urlField}`;
}

function extractContent(data: any): { content: string | null; mediaUrl: string | null; mediaMetadata: any } {
  const type = data.messageType;
  let content: string | null = null;
  let mediaUrl: string | null = null;
  let mediaMetadata: any = null;

  switch (type) {
    case "text":
      content = data.text?.message || null;
      break;
    case "audio":
      content = "[Áudio]";
      mediaUrl = getMediaUrl(data.audio?.url || data.audio?.audioUrl);
      mediaMetadata = { duration: data.audio?.duration, filesize: data.audio?.filesize, mimetype: data.audio?.mimetype, filename: data.audio?.filename };
      break;
    case "image":
      content = data.image?.caption || "[Imagem]";
      mediaUrl = getMediaUrl(data.image?.url || data.image?.imageUrl);
      mediaMetadata = { filesize: data.image?.filesize, mimetype: data.image?.mimetype, filename: data.image?.filename, caption: data.image?.caption };
      break;
    case "document":
      content = data.text?.message || "[Documento]";
      mediaUrl = getMediaUrl(data.document?.url || data.document?.documentUrl);
      mediaMetadata = { filesize: data.document?.filesize, mimetype: data.document?.mimetype, filename: data.document?.filename };
      break;
    case "sticker":
      content = "[Sticker]";
      mediaUrl = getMediaUrl(data.sticker?.url);
      break;
    case "video":
      content = data.video?.caption || "[Vídeo]";
      mediaUrl = getMediaUrl(data.video?.videoUrl);
      mediaMetadata = { duration: data.video?.duration, filesize: data.video?.filesize, mimetype: data.video?.mimetype };
      break;
    case "location":
      content = `📍 ${data.location?.name || "Localização"}`;
      mediaMetadata = { latitude: data.location?.latitude, longitude: data.location?.longitude, address: data.location?.address };
      break;
    case "contact":
      content = `👤 ${data.contact?.name || "Contato"}`;
      mediaMetadata = { name: data.contact?.name, number: data.contact?.number };
      break;
    default:
      content = `[${type}]`;
  }

  return { content, mediaUrl, mediaMetadata };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { event, data } = body;

    if (event !== "message_received" || !data) {
      return new Response(JSON.stringify({ success: true, skipped: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Skip group messages
    if (data.isGroup) {
      return new Response(JSON.stringify({ success: true, skipped: "group" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const phone = data.phone;
    const messageId = data.messageId;
    const direction = data.fromMe ? "outbound" : "inbound";
    const senderName = data.senderName || phone;
    const senderPhoto = data.senderPhoto || data.photo || null;
    const messageType = data.messageType || "text";
    const timestamp = data.momment ? new Date(data.momment).toISOString() : new Date().toISOString();

    const { content, mediaUrl, mediaMetadata } = extractContent(data);

    // Check deduplication
    if (messageId) {
      const { data: existing } = await supabase
        .from("whatsapp_messages")
        .select("id")
        .eq("message_id_external", messageId)
        .maybeSingle();

      if (existing) {
        return new Response(JSON.stringify({ success: true, skipped: "duplicate" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Find or create conversation - we need a closer_id
    // For now, find any conversation with this phone, or find a closer by matching client phone
    let { data: conversation } = await supabase
      .from("whatsapp_conversations")
      .select("id, closer_id")
      .eq("phone", phone)
      .maybeSingle();

    if (!conversation) {
      // Try to find a client with this phone to get the closer_id
      const cleanPhone = phone.replace(/\D/g, "");
      const { data: client } = await supabase
        .from("clients")
        .select("id, closer_id, name")
        .or(`phone.eq.${cleanPhone},phone.eq.${phone}`)
        .limit(1)
        .maybeSingle();

      if (client) {
        // Create conversation linked to the client's closer
        const { data: newConvo, error: convoError } = await supabase
          .from("whatsapp_conversations")
          .insert({
            closer_id: client.closer_id,
            client_id: client.id,
            phone,
            contact_name: senderName || client.name,
            contact_photo: senderPhoto,
            last_message_at: timestamp,
            last_message_preview: content,
            unread_count: direction === "inbound" ? 1 : 0,
          })
          .select("id, closer_id")
          .single();

        if (convoError) {
          // Might be unique constraint - try fetching again
          const { data: retryConvo } = await supabase
            .from("whatsapp_conversations")
            .select("id, closer_id")
            .eq("phone", phone)
            .maybeSingle();
          conversation = retryConvo;
        } else {
          conversation = newConvo;
        }
      } else {
        // No client found - we can't determine closer_id, skip or use a default
        // For now, log and skip
        console.log(`No client found for phone ${phone}, skipping message`);
        return new Response(JSON.stringify({ success: true, skipped: "no_closer" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    if (!conversation) {
      return new Response(JSON.stringify({ success: true, skipped: "no_conversation" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Insert message
    const { error: msgError } = await supabase.from("whatsapp_messages").insert({
      conversation_id: conversation.id,
      message_id_external: messageId || null,
      direction,
      message_type: messageType,
      content,
      media_url: mediaUrl,
      media_metadata: mediaMetadata,
      sender_name: senderName,
      from_api: data.fromApi || false,
      status: "delivered",
      created_at: timestamp,
    });

    if (msgError) {
      console.error("Error inserting message:", msgError);
      throw msgError;
    }

    // Update conversation
    const updateData: any = {
      last_message_at: timestamp,
      last_message_preview: content,
      contact_photo: senderPhoto || undefined,
    };

    if (direction === "inbound") {
      // Increment unread count using RPC or raw update
      const { data: currentConvo } = await supabase
        .from("whatsapp_conversations")
        .select("unread_count")
        .eq("id", conversation.id)
        .single();

      updateData.unread_count = (currentConvo?.unread_count || 0) + 1;
    }

    if (!data.fromMe && senderName) {
      updateData.contact_name = senderName;
    }

    await supabase
      .from("whatsapp_conversations")
      .update(updateData)
      .eq("id", conversation.id);

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Webhook error:", error);
    // Always return 200 to avoid retries
    return new Response(JSON.stringify({ success: true, error: String(error) }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
