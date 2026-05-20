import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { pipeline_card_id } = await req.json();
    if (!pipeline_card_id) {
      return new Response(JSON.stringify({ error: "pipeline_card_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Fetch pipeline card
    const { data: card, error: cardError } = await supabase
      .from("sales_pipeline")
      .select("*")
      .eq("id", pipeline_card_id)
      .single();

    if (cardError || !card) {
      return new Response(JSON.stringify({ error: "Pipeline card not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Idempotency
    if (card.webhook_sent_at) {
      return new Response(
        JSON.stringify({ message: "Webhook already sent", sent_at: card.webhook_sent_at }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Fetch active webhooks for pipeline_sale_finalized event
    const { data: webhooks, error: webhookError } = await supabase
      .from("webhook_configs")
      .select("*")
      .eq("event_type", "pipeline_sale_finalized")
      .eq("is_active", true);

    if (webhookError) {
      console.error("Error fetching webhooks:", webhookError);
      return new Response(JSON.stringify({ error: "Failed to fetch webhook configs" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!webhooks || webhooks.length === 0) {
      return new Response(JSON.stringify({ message: "No active webhooks" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch full client
    const { data: client } = await supabase
      .from("clients")
      .select("*")
      .eq("id", card.client_id)
      .maybeSingle();

    const productOffered = client?.product_offered || card.product_offered || "";

    // Filter webhooks by product_filter
    const matchingWebhooks = webhooks.filter((webhook) => {
      if (!webhook.product_filter || webhook.product_filter.length === 0) return true;
      const p = productOffered.toLowerCase();
      return webhook.product_filter.some((f: string) => p.includes(f.toLowerCase()));
    });

    if (matchingWebhooks.length === 0) {
      console.log(`No webhooks match product: ${productOffered}`);
      return new Response(
        JSON.stringify({ message: "No webhooks match product filter", product: productOffered }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Closer name
    const { data: closerProfile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("user_id", card.closer_id)
      .maybeSingle();

    // Latest transcription
    const { data: call } = await supabase
      .from("calls")
      .select("transcription")
      .eq("client_id", card.client_id)
      .is("deleted_at", null)
      .order("call_date", { ascending: false })
      .limit(1)
      .maybeSingle();

    const payload = {
      event: "pipeline_sale_finalized",
      timestamp: new Date().toISOString(),
      client: {
        id: card.client_id,
        name: client?.name ?? card.name,
        email: client?.email ?? card.email,
        phone: client?.phone ?? card.phone,
        company: client?.company ?? card.company,
        niche: client?.niche ?? null,
        instagram: client?.instagram ?? null,
        source: client?.source ?? null,
        sdr_name: client?.sdr_name ?? null,
        funnel_source: client?.funnel_source ?? null,
        has_partner: client?.has_partner ?? null,
        main_pain: client?.main_pain ?? null,
        main_difficulty: client?.main_difficulty ?? null,
        product_offered: productOffered,
      },
      sale: {
        sale_value: card.sale_value ?? client?.sale_value ?? null,
        entry_value: card.entry_value ?? client?.entry_value ?? null,
        sold_at: card.sold_at ?? client?.sold_at ?? null,
        contract_validity: client?.contract_validity ?? null,
        sale_notes: client?.sale_notes ?? null,
        notes: card.notes ?? null,
      },
      closer_name: closerProfile?.full_name || null,
      transcription: call?.transcription || null,
    };

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
        console.log(`Webhook ${webhook.name} (${webhook.url}): ${response.status} - ${responseText.substring(0, 200)}`);
        return { webhook_name: webhook.name, status: response.status, success: response.ok };
      }),
    );

    const anySuccess = results.some(
      (r) => r.status === "fulfilled" && (r.value as any).success,
    );

    if (anySuccess) {
      await supabase
        .from("sales_pipeline")
        .update({ webhook_sent_at: new Date().toISOString() })
        .eq("id", pipeline_card_id);
    }

    return new Response(JSON.stringify({ success: true, results }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in send-pipeline-sale-webhook:", error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
