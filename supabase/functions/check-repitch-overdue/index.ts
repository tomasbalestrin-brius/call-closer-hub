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

    console.log('Checking for clients in repitch for more than 7 days...');

    // Data de 7 dias atrás
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    // Buscar clientes em repitch há mais de 7 dias sem notificação enviada
    const { data: overdueClients, error: clientsError } = await supabase
      .from('clients')
      .select('id, name, closer_id, status_changed_at')
      .eq('status', 'repitch')
      .lt('status_changed_at', sevenDaysAgo)
      .eq('repitch_overdue_notification_sent', false);

    if (clientsError) throw clientsError;

    console.log(`Found ${overdueClients?.length || 0} overdue repitch clients`);

    if (!overdueClients || overdueClients.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No overdue repitch clients found', count: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Buscar todos os admins
    const { data: admins } = await supabase
      .from('user_roles')
      .select('user_id')
      .eq('role', 'admin');

    const adminIds = admins?.map(a => a.user_id) || [];
    console.log(`Found ${adminIds.length} admins to notify`);

    let notificationsSent = 0;
    let clientsProcessed = 0;

    for (const client of overdueClients) {
      try {
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

        const usersToNotify = new Set<string>();
        
        // Adicionar líder
        if (leaderId) {
          usersToNotify.add(leaderId);
          console.log(`Will notify leader: ${leaderId}`);
        }
        
        // Adicionar todos os admins
        adminIds.forEach(id => usersToNotify.add(id));

        // Calcular dias em repitch
        const daysInRepitch = Math.floor(
          (Date.now() - new Date(client.status_changed_at).getTime()) / (1000 * 60 * 60 * 24)
        );

        // Enviar notificações
        for (const userId of usersToNotify) {
          const { error } = await supabase.rpc('create_client_notification', {
            p_user_id: userId,
            p_title: '🔴 Cliente em Repitch há mais de 7 dias',
            p_message: `O cliente "${client.name}" do closer ${closerName} está em Repitch há ${daysInRepitch} dias. Necessita atenção urgente.`,
            p_type: 'alert'
          });

          if (!error) {
            notificationsSent++;
            console.log(`Notification sent to user ${userId} for client ${client.name}`);
          } else {
            console.error(`Failed to notify user ${userId}:`, error);
          }
        }

        // Marcar notificação como enviada
        const { error: updateError } = await supabase
          .from('clients')
          .update({ repitch_overdue_notification_sent: true })
          .eq('id', client.id);

        if (updateError) {
          console.error(`Failed to mark client ${client.id} as notified:`, updateError);
        } else {
          clientsProcessed++;
        }

      } catch (clientError) {
        console.error(`Error processing client ${client.id}:`, clientError);
      }
    }

    console.log(`Check completed. Clients processed: ${clientsProcessed}, Notifications sent: ${notificationsSent}`);

    return new Response(
      JSON.stringify({ 
        message: 'Check completed',
        clientsProcessed,
        notificationsSent 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in check-repitch-overdue:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
