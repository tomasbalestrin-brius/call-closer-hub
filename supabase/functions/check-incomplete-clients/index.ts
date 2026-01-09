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

    console.log('Checking for incomplete clients older than 24 hours...');

    // Buscar clientes criados há mais de 24h sem dados completos e sem notificação enviada
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const { data: incompleteClients, error: clientsError } = await supabase
      .from('clients')
      .select('id, name, closer_id, created_at')
      .lt('created_at', twentyFourHoursAgo)
      .is('data_completed_at', null)
      .eq('incomplete_notification_sent', false)
      .or('phone.is.null,phone.eq.,revenue.is.null,product_offered.is.null,product_offered.eq.');

    if (clientsError) {
      console.error('Error fetching incomplete clients:', clientsError);
      throw clientsError;
    }

    console.log(`Found ${incompleteClients?.length || 0} incomplete clients`);

    if (!incompleteClients || incompleteClients.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No incomplete clients found', count: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let notificationsSent = 0;

    for (const client of incompleteClients) {
      try {
        // Buscar nome do closer
        const { data: closerProfile } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('user_id', client.closer_id)
          .single();

        const closerName = closerProfile?.full_name || 'Closer';

        // Criar notificação para o closer
        const { error: closerNotifError } = await supabase.rpc('create_client_notification', {
          p_user_id: client.closer_id,
          p_title: '⚠️ Cliente com dados pendentes',
          p_message: `O cliente "${client.name}" foi criado há mais de 24 horas e ainda não teve os dados preenchidos (telefone, faturamento, produto). Por favor, complete o cadastro.`,
          p_type: 'alert'
        });

        if (closerNotifError) {
          console.error('Error creating closer notification:', closerNotifError);
        } else {
          notificationsSent++;
        }

        // Buscar líder do squad do closer
        const { data: leaderId } = await supabase.rpc('get_squad_leader_for_closer', {
          p_closer_id: client.closer_id
        });

        if (leaderId) {
          // Criar notificação para o líder
          const { error: leaderNotifError } = await supabase.rpc('create_client_notification', {
            p_user_id: leaderId,
            p_title: '⚠️ Cliente pendente no squad',
            p_message: `O cliente "${client.name}" do closer ${closerName} foi criado há mais de 24 horas sem dados completos.`,
            p_type: 'alert'
          });

          if (leaderNotifError) {
            console.error('Error creating leader notification:', leaderNotifError);
          } else {
            notificationsSent++;
          }
        }

        // Marcar que notificação foi enviada para este cliente
        await supabase
          .from('clients')
          .update({ incomplete_notification_sent: true })
          .eq('id', client.id);

      } catch (clientError) {
        console.error(`Error processing client ${client.id}:`, clientError);
      }
    }

    console.log(`Sent ${notificationsSent} notifications`);

    return new Response(
      JSON.stringify({ 
        message: 'Check completed', 
        clientsProcessed: incompleteClients.length,
        notificationsSent 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in check-incomplete-clients:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
