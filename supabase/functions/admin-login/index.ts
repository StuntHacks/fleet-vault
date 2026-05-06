import { createClient } from 'jsr:@supabase/supabase-js@2';
import { createHash } from 'node:crypto';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const serviceClient = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const { token } = await req.json();
  if (!token) return new Response('Missing token', { status: 400, headers: corsHeaders });

  const hash = createHash('sha256').update(token).digest('hex');

  const { data, error } = await serviceClient
    .from('admins')
    .select('id, label')
    .eq('token_hash', hash)
    .single();

  if (error || !data) return new Response('Invalid token', { status: 401, headers: corsHeaders });

  const { data: auth, error: authError } = await serviceClient.auth.signInWithPassword({
    email: Deno.env.get('ADMIN_ACCOUNT_EMAIL')!,
    password: Deno.env.get('ADMIN_ACCOUNT_PASSWORD')!,
  });

  if (authError) return new Response('Auth error', { status: 500, headers: corsHeaders });

  return new Response(
    JSON.stringify({ session: auth.session, adminLabel: data.label }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
});
