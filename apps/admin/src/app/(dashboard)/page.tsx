import Link from 'next/link';
import { requireAdmin } from '@/lib/supabase';
import { formatMAD } from '@/lib/format';

export default async function Dashboard() {
  const { supabase } = await requireAdmin();
  const count = async (table: string, filter?: (q: any) => any) => {
    let q = supabase.from(table).select('*', { count: 'exact', head: true });
    if (filter) q = filter(q);
    return (await q).count ?? 0;
  };
  const [pending, active, disputes, users] = await Promise.all([
    count('provider_profiles', (q) => q.eq('verification_status', 'pending')),
    count('missions', (q) => q.in('status', ['in_progress', 'disputed'])),
    count('disputes', (q) => q.eq('status', 'open')),
    count('profiles'),
  ]);
  const { data: txs } = await supabase.from('transactions').select('type, amount_cents');
  const sum = (t: string) => (txs ?? []).filter((x) => x.type === t).reduce((a, x) => a + x.amount_cents, 0);
  const escrow = sum('deposit') - sum('release') - sum('commission') - sum('refund');

  return (
    <>
      <h1>Tableau de bord</h1>
      <div className="grid">
        <Link href="/verifications" className="card" style={{ textDecoration: 'none', color: 'inherit' }}>
          <div className="muted">Vérifications en attente</div><div className="stat">{pending}</div></Link>
        <Link href="/missions" className="card" style={{ textDecoration: 'none', color: 'inherit' }}>
          <div className="muted">Missions actives</div><div className="stat">{active}</div></Link>
        <Link href="/disputes" className="card" style={{ textDecoration: 'none', color: 'inherit' }}>
          <div className="muted">Litiges ouverts</div><div className="stat" style={{ color: disputes ? 'var(--danger)' : undefined }}>{disputes}</div></Link>
        <div className="card"><div className="muted">Utilisateurs</div><div className="stat">{users}</div></div>
        <div className="card"><div className="muted">Fonds en séquestre</div><div className="stat">{formatMAD(escrow)}</div></div>
        <div className="card"><div className="muted">Commissions perçues</div><div className="stat">{formatMAD(sum('commission'))}</div></div>
      </div>
      <p className="notice" style={{ marginTop: 20 }}>Mode paiement simulé : aucun flux financier réel.</p>
    </>
  );
}
