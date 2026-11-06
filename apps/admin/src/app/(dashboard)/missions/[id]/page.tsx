import type { Milestone, Mission, Report, ReportMedia, Transaction } from '@wasla/shared';
import { requireAdmin } from '@/lib/supabase';
import { Badge } from '@/components/Badge';
import { STATUS_FR, fmtDate, formatMAD } from '@/lib/format';
import { cancelMission } from '../../actions';

export default async function MissionDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string }> }) {
  const { id } = await params;
  const { error } = await searchParams;
  const { supabase } = await requireAdmin();
  const [{ data: m }, { data: ms }, { data: txs }, { data: reports }] = await Promise.all([
    supabase.from('missions').select('*, client:profiles!missions_client_id_fkey(full_name), provider:profiles!missions_provider_id_fkey(full_name)').eq('id', id).single(),
    supabase.from('milestones').select('*').eq('mission_id', id).order('position'),
    supabase.from('transactions').select('*').eq('mission_id', id).order('created_at'),
    supabase.from('reports').select('*, report_media(*), milestones!inner(mission_id)').eq('milestones.mission_id', id).order('created_at'),
  ]);
  const mission = m as (Mission & { client: { full_name: string } | null; provider: { full_name: string } | null }) | null;
  if (!mission) return <p>Mission introuvable.</p>;
  const media = ((reports ?? []) as (Report & { report_media: ReportMedia[] })[]).flatMap((r) => r.report_media);
  const { data: signed } = media.length ? await supabase.storage.from('reports').createSignedUrls(media.map((x) => x.storage_path), 600) : { data: [] };

  return (
    <div className="stack">
      <h1>{mission.title} <Badge status={mission.status} /></h1>
      {error ? <p className="alert">{decodeURIComponent(error)}</p> : null}
      <div className="card">
        <p>Client : <strong>{mission.client?.full_name ?? '—'}</strong> · Prestataire : <strong>{mission.provider?.full_name ?? '—'}</strong></p>
        <p>Total : {formatMAD(mission.total_cents)} · Commission : {Math.round(Number(mission.commission_rate) * 100)} % · Créée {fmtDate(mission.created_at)}</p>
        {['in_progress', 'disputed'].includes(mission.status) ? (
          <form action={cancelMission}><input type="hidden" name="mission" value={mission.id} />
            <button className="btn btn-danger">Annuler la mission (rembourse les étapes financées)</button></form>
        ) : null}
      </div>
      <h2>Étapes</h2>
      <table>
        <thead><tr><th>#</th><th>Étape</th><th>Montant</th><th>Statut</th><th>Financée</th><th>Rapport</th><th>Payée</th></tr></thead>
        <tbody>{((ms ?? []) as Milestone[]).map((x) => (
          <tr key={x.id}><td>{x.position}</td><td>{x.title}</td><td>{formatMAD(x.amount_cents)}</td><td><Badge status={x.status} /></td>
            <td>{fmtDate(x.funded_at)}</td><td>{fmtDate(x.submitted_at)}</td><td>{fmtDate(x.released_at)}</td></tr>
        ))}</tbody>
      </table>
      <h2>Transactions</h2>
      <table>
        <thead><tr><th>Date</th><th>Type</th><th>Montant</th><th>Référence</th></tr></thead>
        <tbody>{((txs ?? []) as Transaction[]).map((t) => (
          <tr key={t.id}><td>{fmtDate(t.created_at)}</td><td>{STATUS_FR[t.type]}</td><td>{formatMAD(t.amount_cents)}</td><td className="muted">{t.provider_ref}</td></tr>
        ))}</tbody>
      </table>
      <h2>Rapports</h2>
      {((reports ?? []) as (Report & { report_media: ReportMedia[] })[]).map((r) => (
        <div key={r.id} className="card stack">
          <span className="muted">{fmtDate(r.created_at)}</span><p>{r.body}</p>
          <div className="docs">{r.report_media.map((x) => {
            const u = signed?.find((s) => s.path === x.storage_path)?.signedUrl;
            return (
              <div key={x.id}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {u ? (x.kind === 'photo' ? <img src={u} alt="Preuve" /> : <video src={u} controls style={{ width: '100%' }} />) : <p className="muted">Fichier indisponible</p>}
                <p className="muted">{fmtDate(x.captured_at)} · <a target="_blank" rel="noreferrer"
                  href={`https://www.openstreetmap.org/?mlat=${x.latitude}&mlon=${x.longitude}#map=18/${x.latitude}/${x.longitude}`}>
                  {x.latitude.toFixed(5)}, {x.longitude.toFixed(5)}</a>{x.accuracy_m ? ` ± ${Math.round(x.accuracy_m)} m` : ''}</p>
              </div>
            );
          })}</div>
        </div>
      ))}
    </div>
  );
}
