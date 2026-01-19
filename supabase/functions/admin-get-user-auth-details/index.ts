import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create admin client
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Create user client to verify JWT
    const supabaseUser = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { 
        global: { headers: { Authorization: authHeader } },
        auth: { autoRefreshToken: false, persistSession: false } 
      }
    );

    // Verify the requesting user is authenticated
    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      console.error('Auth error:', userError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user has admin or super_admin role
    const { data: roles, error: rolesError } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id);

    if (rolesError) {
      console.error('Roles error:', rolesError);
      return new Response(
        JSON.stringify({ error: 'Failed to verify permissions' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const hasAdminRole = roles?.some(r => r.role === 'admin' || r.role === 'super_admin');
    if (!hasAdminRole) {
      console.log('User does not have admin role');
      return new Response(
        JSON.stringify({ error: 'Insufficient permissions' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { userIds } = await req.json();

    if (!Array.isArray(userIds) || userIds.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Invalid user IDs' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Limit to prevent abuse
    if (userIds.length > 100) {
      return new Response(
        JSON.stringify({ error: 'Maximum 100 users per request' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Fetching auth details for ${userIds.length} users`);

    // Fetch auth details for each user
    const userAuthDetails: { [key: string]: { email: string | null; phone: string | null; created_at: string | null; last_sign_in_at: string | null; email_confirmed_at: string | null } } = {};

    for (const userId of userIds) {
      try {
        const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.getUserById(userId);
        
        if (!authError && authUser?.user) {
          userAuthDetails[userId] = {
            email: authUser.user.email || null,
            phone: authUser.user.phone || null,
            created_at: authUser.user.created_at || null,
            last_sign_in_at: authUser.user.last_sign_in_at || null,
            email_confirmed_at: authUser.user.email_confirmed_at || null
          };
        } else {
          console.log(`Could not fetch auth for user ${userId}:`, authError?.message);
          userAuthDetails[userId] = {
            email: null,
            phone: null,
            created_at: null,
            last_sign_in_at: null,
            email_confirmed_at: null
          };
        }
      } catch (err) {
        console.error(`Error fetching user ${userId}:`, err);
        userAuthDetails[userId] = {
          email: null,
          phone: null,
          created_at: null,
          last_sign_in_at: null,
          email_confirmed_at: null
        };
      }
    }

    console.log(`Successfully fetched auth details for ${Object.keys(userAuthDetails).length} users`);

    return new Response(
      JSON.stringify({ success: true, users: userAuthDetails }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
