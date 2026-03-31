import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { client_id } = await req.json();

    if (!client_id) {
      return new Response(
        JSON.stringify({ error: "client_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch active webhooks for sale_closed event
    const { data: webhooks, error: webhookError } = await supabase
      .from("webhook_configs")
      .select("*")
      .eq("event_type", "sale_closed")
      .eq("is_active", true);

    if (webhookError) {
      console.error("Error fetching webhooks:", webhookError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch webhook configs" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!webhooks || webhooks.length === 0) {
      console.log("No active webhooks for sale_closed event");
      return new Response(
        JSON.stringify({ message: "No active webhooks" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch the client with sale data
    const { data: client, error: clientError } = await supabase
      .from("clients")
      .select("*")
      .eq("id", client_id)
      .single();

    if (clientError || !client) {
      console.error("Error fetching client:", clientError);
      return new Response(
        JSON.stringify({ error: "Client not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch closer name only
    const { data: closerProfile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("user_id", client.closer_id)
      .single();

    // Fetch only the transcription from the most recent call
    const { data: call } = await supabase
      .from("calls")
      .select("transcription")
      .eq("client_id", client_id)
      .is("deleted_at", null)
      .order("call_date", { ascending: false })
      .limit(1)
      .single();

    // Build the payload
    const payload = {
      event: "sale_closed",
      timestamp: new Date().toISOString(),
      client: {
        id: client.id,
        name: client.name,
        email: client.email,
        phone: client.phone,
        company: client.company,
        niche: client.niche,
        instagram: client.instagram,
        source: client.source,
        sdr_name: client.sdr_name,
        funnel_source: client.funnel_source,
        has_partner: client.has_partner,
        main_pain: client.main_pain,
        main_difficulty: client.main_difficulty,
        product_offered: client.product_offered,
      },
      sale: {
        sale_value: client.sale_value,
        entry_value: client.entry_value,
        sold_at: client.sold_at,
        contract_validity: client.contract_validity,
        negotiation_notes: client.negotiation_notes,
        sale_notes: client.sale_notes,
      },
      closer_name: closerProfile?.full_name || null,
      transcription: call?.transcription || null,
    };

    // Filter webhooks by product_filter (if configured)
    const matchingWebhooks = webhooks.filter((webhook) => {
      // If no product_filter, send to all products
      if (!webhook.product_filter || webhook.product_filter.length === 0) {
        return true;
      }
      // Check if client's product matches any filter (case-insensitive)
      const clientProduct = (client.product_offered || "").toLowerCase();
      return webhook.product_filter.some(
        (filter: string) => clientProduct.includes(filter.toLowerCase())
      );
    });

    if (matchingWebhooks.length === 0) {
      console.log(`No webhooks match product: ${client.product_offered}`);
      return new Response(
        JSON.stringify({ message: "No webhooks match product filter", product: client.product_offered }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Send to matching webhooks
    const results = await Promise.allSettled(
      matchingWebhooks.map(async (webhook) => {
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
          ...(webhook.headers || {}),
        };

        const response = await fetch(webhook.url, {
          method: "POST",
          headers,
          body: JSON.stringify(payload),
        });

        const responseText = await response.text();

        console.log(
          `Webhook ${webhook.name} (${webhook.url}): ${response.status} - ${responseText.substring(0, 200)}`
        );

        return {
          webhook_name: webhook.name,
          status: response.status,
          success: response.ok,
        };
      })
    );

    console.log("Webhook results:", JSON.stringify(results));

    return new Response(
      JSON.stringify({ success: true, results }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in send-sale-webhook:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
