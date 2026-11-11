'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireAdmin, supabaseServer } from '@/lib/supabase';

/** Toutes les actions passent par des RPC qui revérifient le rôle admin côté base (private.require_admin). */
async function rpc(fn: string, args: Record<string, unknown>, path: string) {
  const { supabase } = await requireAdmin();
  const { error } = await supabase.rpc(fn, args);
  if (error) redirect(`${path}?error=${encodeURIComponent(error.message)}`);
  revalidatePath(path);
}

const str = (f: FormData, k: string) => String(f.get(k) ?? '').trim();

export async function reviewDocument(f: FormData) {
  await rpc('admin_review_document', { p_doc: str(f, 'doc'), p_status: str(f, 'status'), p_note: str(f, 'note') || null },
    `/verifications/${str(f, 'provider')}`);
}

export async function setVerification(f: FormData) {
  const provider = str(f, 'provider');
  await rpc('admin_set_verification', { p_provider: provider, p_status: str(f, 'status'), p_reason: str(f, 'reason') || null },
    `/verifications/${provider}`);
}

export async function setSuspended(f: FormData) {
  await rpc('admin_set_suspended', { p_user: str(f, 'user'), p_suspended: str(f, 'suspended') === 'true', p_reason: str(f, 'reason') || null }, '/users');
}

export async function resolveDispute(f: FormData) {
  await rpc('admin_resolve_dispute', { p_dispute: str(f, 'dispute'), p_resolution: str(f, 'resolution'), p_note: str(f, 'note') || null }, '/disputes');
}

export async function cancelMission(f: FormData) {
  await rpc('cancel_mission', { p_mission: str(f, 'mission') }, `/missions/${str(f, 'mission')}`);
}

export async function setCommission(f: FormData) {
  const pct = Number(str(f, 'rate').replace(',', '.'));
  if (!Number.isFinite(pct) || pct < 0 || pct >= 100) redirect('/settings?error=invalid_rate');
  await rpc('admin_set_commission_rate', { p_rate: pct / 100 }, '/settings');
}

export async function upsertService(f: FormData) {
  const { supabase } = await requireAdmin();
  const row = {
    slug: str(f, 'slug'), name_fr: str(f, 'name_fr'), name_ar: str(f, 'name_ar'), name_en: str(f, 'name_en'),
    description_fr: str(f, 'description_fr'), description_ar: str(f, 'description_ar'), description_en: str(f, 'description_en'),
    icon: str(f, 'icon') || 'briefcase', sort_order: Number(str(f, 'sort_order')) || 0, is_active: f.get('is_active') === 'on',
  };
  const id = str(f, 'id');
  const { error } = id ? await supabase.from('services').update(row).eq('id', id) : await supabase.from('services').insert(row);
  if (error) redirect(`/services?error=${encodeURIComponent(error.message)}`);
  revalidatePath('/services');
}

export async function signOut() {
  const supabase = await supabaseServer();
  await supabase.auth.signOut();
  redirect('/login');
}
