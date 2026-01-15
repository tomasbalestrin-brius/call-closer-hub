import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { closerName, days = 7, reanalyzeAll = false } = await req.json();

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    let calls;

    if (reanalyzeAll) {
      // Reanalyze ALL calls from ALL closers that have technical_analysis but missing framework_escolhido
      console.log('Reanalyzing ALL calls from all closers...');
      
      const { data: allCalls, error: fetchError } = await supabase
        .from('calls')
        .select('id, client_name, call_date, closer_id')
        .not('technical_analysis', 'is', null)
        .order('call_date', { ascending: false });

      if (fetchError) {
        console.error('Error fetching all calls:', fetchError);
        throw new Error(`Erro ao buscar calls: ${fetchError.message}`);
      }

      // Filter calls that don't have framework_escolhido or need reanalysis
      calls = allCalls || [];
      console.log(`Found ${calls.length} total calls to potentially reanalyze`);
    } else {
      // Original logic: reanalyze by closer name
      if (!closerName) {
        return new Response(
          JSON.stringify({ error: 'closerName é obrigatório (ou use reanalyzeAll: true)' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // First, find the closer's user_id by their name
      const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('user_id, full_name')
        .ilike('full_name', `%${closerName}%`);

      if (profileError) {
        console.error('Error fetching profiles:', profileError);
        throw new Error(`Erro ao buscar perfil: ${profileError.message}`);
      }

      if (!profiles || profiles.length === 0) {
        return new Response(
          JSON.stringify({ error: `Nenhum closer encontrado com nome "${closerName}"` }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const closerIds = profiles.map(p => p.user_id);
      console.log(`Found ${profiles.length} closers matching "${closerName}":`, profiles.map(p => p.full_name));

      // Find calls to reanalyze
      const dateThreshold = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      
      const { data: closerCalls, error: fetchError } = await supabase
        .from('calls')
        .select('id, client_name, call_date, closer_id')
        .in('closer_id', closerIds)
        .not('technical_analysis', 'is', null)
        .gte('call_date', dateThreshold)
        .order('call_date', { ascending: false });

      if (fetchError) {
        console.error('Error fetching calls:', fetchError);
        throw new Error(`Erro ao buscar calls: ${fetchError.message}`);
      }

      calls = closerCalls || [];
      console.log(`Found ${calls.length} calls to reanalyze for ${closerName}`);
    }

    if (!calls || calls.length === 0) {
      return new Response(
        JSON.stringify({ message: 'Nenhuma call encontrada para reanalisar', count: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Starting reanalysis of ${calls.length} calls...`);

    // Start background processing
    const reanalyzeInBackground = async () => {
      const results = [];
      
      for (const call of calls) {
        try {
          console.log(`Reanalyzing call ${call.id} - ${call.client_name}...`);
          
          // Call the reanalyze-call function
          const response = await fetch(`${supabaseUrl}/functions/v1/reanalyze-call`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${supabaseServiceKey}`,
            },
            body: JSON.stringify({ callId: call.id }),
          });

          const result = await response.json();
          
          if (response.ok) {
            console.log(`✅ Reanalyzed call ${call.id}: score ${result.score}`);
            results.push({ 
              id: call.id, 
              client_name: call.client_name, 
              success: true, 
              score: result.score 
            });
          } else {
            console.error(`❌ Failed to reanalyze call ${call.id}:`, result.error);
            results.push({ 
              id: call.id, 
              client_name: call.client_name, 
              success: false, 
              error: result.error 
            });
          }

          // Add a small delay between calls to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 2000));
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : 'Unknown error';
          console.error(`Error reanalyzing call ${call.id}:`, errorMessage);
          results.push({ 
            id: call.id, 
            client_name: call.client_name, 
            success: false, 
            error: errorMessage 
          });
        }
      }

      console.log('Batch reanalysis complete:', results);
      return results;
    };

    // Start background processing (fire and forget)
    reanalyzeInBackground().catch(err => {
      console.error('Background reanalysis failed:', err);
    });

    // Return immediate response
    return new Response(
      JSON.stringify({ 
        message: `Iniciando reanálise de ${calls.length} calls para ${closerName}`,
        calls: calls.map(c => ({ id: c.id, client_name: c.client_name, call_date: c.call_date })),
        status: 'processing'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    console.error('Error in batch-reanalyze:', errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
