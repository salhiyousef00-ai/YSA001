// Edge Function : envoie la notification push correspondant à une ligne de public.notifications.
// Déclenchée par le trigger private.on_notification_inserted (pg_net) avec la clé service.
import { createClient } from 'npm:@supabase/supabase-js@2.119.0';

type Locale = 'fr' | 'ar' | 'en';
const TEXTS: Record<string, Record<Locale, [string, string]>> = {
  new_quote: { fr: ['Nouveau devis', 'Un prestataire vérifié a répondu à votre demande.'], ar: ['عرض جديد', 'ردّ مقدم خدمات موثَّق على طلبك.'], en: ['New quote', 'A verified provider replied to your request.'] },
  quote_accepted: { fr: ['Devis accepté', 'Votre devis a été accepté : la mission commence.'], ar: ['تم قبول العرض', 'تم قبول عرضك: بدأت المهمة.'], en: ['Quote accepted', 'Your quote was accepted: the job has started.'] },
  milestone_funded: { fr: ['Étape financée', 'Le client a déposé le montant en séquestre. Vous pouvez commencer.'], ar: ['تم إيداع المرحلة', 'أودع العميل المبلغ. يمكنك البدء.'], en: ['Milestone funded', 'The client deposited the amount in escrow. You can start.'] },
  new_report: { fr: ['Nouveau rapport', 'Votre prestataire a envoyé un rapport avec preuves.'], ar: ['تقرير جديد', 'أرسل مقدم الخدمة تقريرًا مع الإثباتات.'], en: ['New report', 'Your provider sent a report with proof.'] },
  milestone_approved: { fr: ['Étape validée', 'Le paiement de l’étape vous a été versé.'], ar: ['تمت الموافقة على المرحلة', 'تم صرف مبلغ المرحلة لك.'], en: ['Milestone approved', 'The milestone payment has been released to you.'] },
  new_message: { fr: ['Nouveau message', ''], ar: ['رسالة جديدة', ''], en: ['New message', ''] },
  verification_update: { fr: ['Vérification', 'Le statut de votre vérification a changé.'], ar: ['التوثيق', 'تغيّرت حالة توثيقك.'], en: ['Verification', 'Your verification status changed.'] },
  dispute_update: { fr: ['Litige', 'Un litige a été mis à jour sur votre mission.'], ar: ['نزاع', 'تم تحديث نزاع في مهمتك.'], en: ['Dispute', 'A dispute was updated on your job.'] },
  mission_cancelled: { fr: ['Mission annulée', 'Une mission a été annulée.'], ar: ['تم إلغاء المهمة', 'تم إلغاء مهمة.'], en: ['Job cancelled', 'A job was cancelled.'] },
};

const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('method not allowed', { status: 405 });
  // Appel interne uniquement : exige la clé service (verify_jwt=false dans config.toml).
  if (req.headers.get('Authorization') !== `Bearer ${SERVICE_KEY}`) return new Response('forbidden', { status: 403 });

  const { notification_id } = await req.json().catch(() => ({}));
  if (typeof notification_id !== 'string') return new Response('bad request', { status: 400 });

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, SERVICE_KEY, { auth: { persistSession: false } });
  const { data: n } = await admin.from('notifications').select('id, user_id, type, payload').eq('id', notification_id).single();
  if (!n) return new Response('not found', { status: 404 });

  const [{ data: profile }, { data: tokens }] = await Promise.all([
    admin.from('profiles').select('locale').eq('id', n.user_id).single(),
    admin.from('push_tokens').select('token').eq('user_id', n.user_id),
  ]);
  if (!tokens?.length) return Response.json({ sent: 0 });

  const locale = (profile?.locale ?? 'fr') as Locale;
  const [title, defaultBody] = TEXTS[n.type]?.[locale] ?? ['Wasla', ''];
  const body = n.type === 'new_message' ? String(n.payload?.preview ?? '') : defaultBody;

  // Données minimales dans la charge utile (identifiants uniquement, pas de données personnelles)
  const messages = tokens.map((t) => ({
    to: t.token, title, body, sound: 'default',
    data: { type: n.type, mission_id: n.payload?.mission_id ?? null, request_id: n.payload?.request_id ?? null },
  }));
  const res = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(messages),
  });
  const json = await res.json().catch(() => ({}));

  // Purge des jetons invalides
  const dead = (json?.data ?? [])
    .map((r: { status: string; details?: { error?: string } }, i: number) => (r.details?.error === 'DeviceNotRegistered' ? tokens[i]?.token : null))
    .filter(Boolean);
  if (dead.length) await admin.from('push_tokens').delete().in('token', dead);

  return Response.json({ sent: messages.length, removed: dead.length });
});
