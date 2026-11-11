import Link from 'next/link';
import { MISSION_STATUSES } from '@wasla/shared';
import { requireAdmin } from '@/lib/supabase';
import { Badge } from '@/components/Badge';
import { fmtDate, formatMAD } from '@/lib/format';

export default async function Missions({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status } = await searchParams;
  const { supabase } = await requireAdmin();
  let q = supabase.from('missions')
    .select('id, title, status, total_cents, created_at, client:profiles!missions_client_id_fkey(full_name), provider:profiles!missions_provider_id_fkey(full_name)')
    .order('created_at', { ascending: false }).limit(200);
  if (status) q = q.eq('status', status);
  const { data } = await q;
  const rows = (data ?? []) as unknown as { id: string; title: string; status: string; total_cents: number; created_at: string;
    client: { full_name: string | null } | null; provider: { full_name: string | null } | null }[];
  return (
    <>
      <h1>Missions</h1>
      <div className="row" style={{ marginBottom: 16 }}>
        <Link href="/missions" className={`btn ${!status ? '' : 'btn-secondary'}`}>Toutes</Link>
        {MISSION_STATUSES.filter((s) => ['in_progress', 'disputed', 'completed', 'cancelled'].includes(s)).map((s) => (
          <Link key={s} href={`/missions?status=${s}`} className={`btn ${s === status ? '' : 'btn-secondary'}`}><Badge status={s} /></Link>
        ))}
      </div>
      <table>
        <thead><tr><th>Mission</th><th>Client</th><th>Prestataire</th><th>Montant</th><th>Créée</th><th>Statut</th></tr></thead>
        <tbody>
          {rows.map((m) => (
            <tr key={m.id}>
              <td><Link href={`/missions/${m.id}`}>{m.title}</Link></td>
              <td>{m.client?.full_name ?? '—'}</td><td>{m.provider?.full_name ?? '—'}</td>
              <td>{formatMAD(m.total_cents)}</td><td>{fmtDate(m.created_at)}</td><td><Badge status={m.status} /></td>
            </tr>
          ))}
          {rows.length === 0 ? <tr><td colSpan={6} className="muted">Aucune mission.</td></tr> : null}
        </tbody>
      </table>
    </>
  );
}
