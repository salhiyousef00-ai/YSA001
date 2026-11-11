import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import type { Profile } from '@wasla/shared';

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/** Client lié à la session de l'admin (cookies). Aucune clé service : les droits viennent de la RLS. */
export async function supabaseServer() {
  const store = await cookies();
  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try { list.forEach(({ name, value, options }) => store.set(name, value, options)); } catch { /* composant serveur : ignoré */ }
      },
    },
  });
}

/** Garde : redirige vers /login si non connecté ou non admin. */
export async function requireAdmin() {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
  const p = profile as Profile | null;
  if (!p || p.role !== 'admin' || p.is_suspended) redirect('/login?error=forbidden');
  return { supabase, user, profile: p };
}
