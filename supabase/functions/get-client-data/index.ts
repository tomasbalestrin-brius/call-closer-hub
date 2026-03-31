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

    // Fetch the client
    const { data: client, error: clientError } = await supabase
      .from("clients")
      .select("*")
      .eq("id", client_id)
      .single();

    if (clientError || !client) {
      return new Response(
        JSON.stringify({ error: "Client not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch closer name
    const { data: closerProfile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("user_id", client.closer_id)
      .single();

    // Fetch transcription from most recent call
    const { data: call } = await supabase
      .from("calls")
      .select("transcription")
      .eq("client_id", client_id)
      .is("deleted_at", null)
      .order("call_date", { ascending: false })
      .limit(1)
      .single();

    // Build the same payload as the webhook
    const payload = {
      event: "client_data",
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
        sold_at: client.sold_at,
        contract_validity: client.contract_validity,
        sale_notes: client.sale_notes,
      },
      closer_name: closerProfile?.full_name || null,
      transcription: call?.transcription || null,
    };

    return new Response(
      JSON.stringify(payload),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in get-client-data:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
