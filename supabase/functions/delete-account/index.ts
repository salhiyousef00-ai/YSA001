// Edge Function : suppression de compte et des données personnelles (loi 09-08 / CNDP).
// 1) anonymisation SQL (bloquée si des fonds sont en séquestre sur une mission active)
// 2) purge des fichiers Storage  3) suppression de l'utilisateur Auth (profil supprimé en cascade)
import { createClient } from 'npm:@supabase/supabase-js@2.119.0';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return new Response('method not allowed', { status: 405, headers: cors });

  const url = Deno.env.get('SUPABASE_URL')!;
  const jwt = req.headers.get('Authorization')?.replace('Bearer ', '') ?? '';
  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });

  // L'identité vient du JWT de l'utilisateur : on ne supprime que SON compte.
  const { data: { user }, error: authError } = await admin.auth.getUser(jwt);
  if (authError || !user) return Response.json({ error: 'not_authenticated' }, { status: 401, headers: cors });

  const { data: paths, error } = await admin.rpc('service_anonymize_user', { p_uid: user.id });
  if (error) {
    const code = error.message.includes('active_escrow') ? 'active_escrow' : 'unknown';
    return Response.json({ error: code }, { status: code === 'active_escrow' ? 409 : 500, headers: cors });
  }

  for (const [bucket, list] of Object.entries((paths ?? {}) as Record<string, string[]>)) {
    if (Array.isArray(list) && list.length) await admin.storage.from(bucket).remove(list);
  }
  // Dossiers propres à l'utilisateur (au cas où des fichiers ne seraient pas référencés en base)
  for (const bucket of ['verification', 'avatars']) {
    const { data: files } = await admin.storage.from(bucket).list(user.id, { limit: 1000 });
    if (files?.length) await admin.storage.from(bucket).remove(files.map((f) => `${user.id}/${f.name}`));
  }

  const { error: delError } = await admin.auth.admin.deleteUser(user.id);
  if (delError) return Response.json({ error: 'unknown' }, { status: 500, headers: cors });

  return Response.json({ ok: true }, { headers: cors });
});
