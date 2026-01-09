import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { clientId } = await req.json();

    if (!clientId) {
      return new Response(
        JSON.stringify({ error: 'clientId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Notifying leader about completed client:', clientId);

    // Buscar dados do cliente
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('id, name, closer_id')
      .eq('id', clientId)
      .single();

    if (clientError || !client) {
      console.error('Error fetching client:', clientError);
      return new Response(
        JSON.stringify({ error: 'Client not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Buscar nome do closer
    const { data: closerProfile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('user_id', client.closer_id)
      .single();

    const closerName = closerProfile?.full_name || 'Closer';

    // Buscar líder do squad do closer
    const { data: leaderId } = await supabase.rpc('get_squad_leader_for_closer', {
      p_closer_id: client.closer_id
    });

    if (leaderId) {
      // Criar notificação para o líder
      const { error: leaderNotifError } = await supabase.rpc('create_client_notification', {
        p_user_id: leaderId,
        p_title: '✅ Cliente preenchido',
        p_message: `O cliente "${client.name}" teve os dados completados pelo closer ${closerName}.`,
        p_type: 'success'
      });

      if (leaderNotifError) {
        console.error('Error creating leader notification:', leaderNotifError);
        throw leaderNotifError;
      }

      console.log('Leader notification sent successfully');
    } else {
      console.log('No squad leader found for closer:', client.closer_id);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Leader notified successfully',
        leaderNotified: !!leaderId
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in notify-client-completed:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
