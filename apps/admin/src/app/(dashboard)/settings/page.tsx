import { requireAdmin } from '@/lib/supabase';
import { fmtDate } from '@/lib/format';
import { setCommission } from '../actions';

export default async function Settings({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const { supabase } = await requireAdmin();
  const [{ data: s }, { data: audit }] = await Promise.all([
    supabase.from('platform_settings').select('*').eq('key', 'commission_rate').single(),
    supabase.from('admin_audit_log').select('*').order('created_at', { ascending: false }).limit(30),
  ]);
  const rate = Number(s?.value ?? 0.15) * 100;
  return (
    <div className="stack">
      <h1>Paramètres</h1>
      {error ? <p className="alert">{decodeURIComponent(error)}</p> : null}
      <form action={setCommission} className="card inline">
        <label>Commission plateforme (%)<input name="rate" type="number" step="0.1" min="0" max="99" defaultValue={rate} required /></label>
        <button className="btn">Enregistrer</button>
        <p className="muted" style={{ width: '100%' }}>Le taux est figé sur chaque mission au moment de l’acceptation du devis. Dernière modification : {fmtDate(s?.updated_at)}</p>
      </form>
      <h2>Journal d’audit</h2>
      <table>
        <thead><tr><th>Date</th><th>Action</th><th>Cible</th><th>Détails</th></tr></thead>
        <tbody>{(audit ?? []).map((a: any) => (
          <tr key={a.id}><td>{fmtDate(a.created_at)}</td><td>{a.action}</td><td className="muted">{a.target_type} {a.target_id}</td><td className="muted">{JSON.stringify(a.details)}</td></tr>
        ))}</tbody>
      </table>
    </div>
  );
}
