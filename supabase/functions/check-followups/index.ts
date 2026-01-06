import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('Checking for follow-ups due today...');

    // Get today's date in ISO format (just the date part)
    const today = new Date().toISOString().split('T')[0];

    // Find all calls with next_contact_date = today
    const { data: calls, error: callsError } = await supabase
      .from('calls')
      .select('id, closer_id, client_name, next_contact_date')
      .eq('next_contact_date', today);

    if (callsError) {
      console.error('Error fetching calls:', callsError);
      throw callsError;
    }

    console.log(`Found ${calls?.length || 0} follow-ups due today`);

    let notificationsCreated = 0;

    // Create a notification for each follow-up
    for (const call of calls || []) {
      // Check if notification already exists for this call today
      const { data: existingNotification } = await supabase
        .from('notifications')
        .select('id')
        .eq('user_id', call.closer_id)
        .eq('type', 'followup')
        .ilike('message', `%${call.client_name}%`)
        .gte('created_at', `${today}T00:00:00`)
        .lte('created_at', `${today}T23:59:59`)
        .single();

      if (existingNotification) {
        console.log(`Notification already exists for ${call.client_name}`);
        continue;
      }

      // Use the SECURITY DEFINER function to bypass RLS
      const { error: notifError } = await supabase.rpc('create_followup_notification', {
        p_user_id: call.closer_id,
        p_title: 'Follow-up Agendado',
        p_message: `Lembrete: Follow-up com ${call.client_name} programado para hoje`,
      });

      if (notifError) {
        console.error(`Error creating notification for ${call.client_name}:`, notifError);
      } else {
        notificationsCreated++;
        console.log(`Created notification for ${call.client_name}`);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        followupsFound: calls?.length || 0,
        notificationsCreated,
        date: today,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error: unknown) {
    console.error('Error in check-followups:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
