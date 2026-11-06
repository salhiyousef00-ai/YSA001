import Link from 'next/link';
import { requireAdmin } from '@/lib/supabase';
import { Badge } from '@/components/Badge';
import { fmtDate, formatMAD } from '@/lib/format';
import { resolveDispute } from '../actions';

export default async function Disputes({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const { supabase } = await requireAdmin();
  const { data } = await supabase.from('disputes')
    .select('*, milestones(title, amount_cents), missions(title)').order('status').order('created_at', { ascending: false });
  const rows = (data ?? []) as unknown as { id: string; mission_id: string; reason: string; status: string; created_at: string;
    resolution_note: string | null; milestones: { title: string; amount_cents: number }; missions: { title: string } }[];
  return (
    <div className="stack">
      <h1>Litiges</h1>
      {error ? <p className="alert">{decodeURIComponent(error)}</p> : null}
      {rows.length === 0 ? <p className="muted">Aucun litige.</p> : null}
      {rows.map((d) => (
        <div key={d.id} className="card stack">
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <strong><Link href={`/missions/${d.mission_id}`}>{d.missions.title}</Link> — {d.milestones.title} ({formatMAD(d.milestones.amount_cents)})</strong>
            <Badge status={d.status === 'open' ? 'disputed' : d.status} label={d.status === 'open' ? 'Ouvert' : undefined} />
          </div>
          <p>« {d.reason} »</p>
          <span className="muted">Ouvert le {fmtDate(d.created_at)}</span>
          {d.resolution_note ? <p className="muted">Résolution : {d.resolution_note}</p> : null}
          {d.status === 'open' ? (
            <form action={resolveDispute} className="stack">
              <input type="hidden" name="dispute" value={d.id} />
              <label>Note de résolution<textarea name="note" required /></label>
              <div className="row">
                <button className="btn" name="resolution" value="release">Verser au prestataire</button>
                <button className="btn btn-danger" name="resolution" value="refund">Rembourser le client</button>
                <button className="btn btn-secondary" name="resolution" value="resubmit">Demander un nouveau rapport</button>
              </div>
            </form>
          ) : null}
        </div>
      ))}
    </div>
  );
}
