import { createClient } from 'jsr:@supabase/supabase-js@2';
import { createHash } from 'node:crypto';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const ADMIN_EMAIL_DOMAIN = Deno.env.get('ADMIN_EMAIL_DOMAIN') ?? 'fleetvault.invalid';
const noSession = { auth: { persistSession: false, autoRefreshToken: false } };

const serviceClient = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, noSession);

const fail = (message: string, status: number) => new Response(message, { status, headers: corsHeaders });

async function ensureAdminUser(admin: { id: number; label: string | null; user_id: string | null }): Promise<string> {
  const email = `admin-${admin.id}@${ADMIN_EMAIL_DOMAIN}`;
  const app_metadata = { fleetvault_admin: true, admin_label: admin.label ?? `admin ${admin.id}` };

  if (admin.user_id) {
    const { error } = await serviceClient.auth.admin.updateUserById(admin.user_id, { app_metadata });
    if (!error) return email;
    console.error('Updating admin user failed, recreating:', error.message);
  }

  let userId: string | undefined;
  const { data: created, error: createError } = await serviceClient.auth.admin.createUser({ email, email_confirm: true, app_metadata });
  if (created?.user) {
    userId = created.user.id;
  } else {
    for (let page = 1; !userId; page++) {
      const { data: list, error } = await serviceClient.auth.admin.listUsers({ page, perPage: 200 });
      if (error || !list.users.length) break;
      userId = list.users.find((u) => u.email === email)?.id;
    }
    if (!userId) throw new Error(`Creating admin user failed: ${createError?.message}`);
    await serviceClient.auth.admin.updateUserById(userId, { app_metadata });
  }

  const { error: linkError } = await serviceClient.from('admins').update({ user_id: userId }).eq('id', admin.id);
  if (linkError) throw new Error(`Linking admin user failed: ${linkError.message}`);
  return email;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  let token: unknown;
  try {
    ({ token } = await req.json());
  } catch {
    return fail('Invalid request', 400);
  }
  if (typeof token !== 'string' || !token) return fail('Missing token', 400);

  const hash = createHash('sha256').update(token).digest('hex');

  const { data: admin, error } = await serviceClient
    .from('admins')
    .select('id, label, user_id')
    .eq('token_hash', hash)
    .maybeSingle();

  if (error) console.error('Admin lookup failed:', error.code, error.message);
  if (error || !admin) return fail('Invalid token', 401);

  try {
    const email = await ensureAdminUser(admin);

    const { data: link, error: linkError } = await serviceClient.auth.admin.generateLink({ type: 'magiclink', email });
    if (linkError || !link.properties?.hashed_token) throw new Error(`Generating login link failed: ${linkError?.message}`);

    const sessionClient = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY')!, noSession);
    const { data: verified, error: verifyError } = await sessionClient.auth.verifyOtp({ type: 'magiclink', token_hash: link.properties.hashed_token });
    if (verifyError || !verified.session) throw new Error(`Creating session failed: ${verifyError?.message}`);

    return new Response(
      JSON.stringify({ session: verified.session, adminLabel: admin.label }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (e) {
    console.error(e instanceof Error ? e.message : e);
    return fail('Auth error', 500);
  }
});
