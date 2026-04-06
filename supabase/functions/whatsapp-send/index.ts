import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Validate auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );

    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { conversation_id, message, type = "text" } = await req.json();

    if (!conversation_id || !message) {
      return new Response(JSON.stringify({ error: "conversation_id and message are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify conversation belongs to user
    const { data: conversation, error: convoError } = await supabase
      .from("whatsapp_conversations")
      .select("id, phone, closer_id")
      .eq("id", conversation_id)
      .eq("closer_id", user.id)
      .single();

    if (convoError || !conversation) {
      return new Response(JSON.stringify({ error: "Conversation not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Send via NextTrack API
    const apiBase = Deno.env.get("NEXTTRACK_API_BASE") || "https://service.nextrack.com.br";
    const instanceId = Deno.env.get("NEXTTRACK_INSTANCE_ID");
    const jwtToken = Deno.env.get("NEXTTRACK_JWT_TOKEN");

    if (!instanceId || !jwtToken) {
      return new Response(JSON.stringify({ error: "NextTrack not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sendUrl = `${apiBase}/api/chats/instances/${instanceId}/send-text`;

    const response = await fetch(sendUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${jwtToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        phone: conversation.phone,
        message,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error("NextTrack API error:", response.status, errorBody);
      return new Response(JSON.stringify({ error: "Failed to send message", details: errorBody }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Save outbound message
    const now = new Date().toISOString();
    await supabase.from("whatsapp_messages").insert({
      conversation_id: conversation.id,
      direction: "outbound",
      message_type: type,
      content: message,
      from_api: true,
      status: "sent",
      created_at: now,
    });

    // Update conversation
    await supabase
      .from("whatsapp_conversations")
      .update({
        last_message_at: now,
        last_message_preview: message,
      })
      .eq("id", conversation.id);

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Send error:", error);
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
