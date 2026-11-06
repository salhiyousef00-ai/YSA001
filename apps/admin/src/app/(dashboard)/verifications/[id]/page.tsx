import { REQUIRED_DOC_TYPES, type VerificationDocument } from '@wasla/shared';
import { requireAdmin } from '@/lib/supabase';
import { Badge } from '@/components/Badge';
import { DOC_FR, fmtDate } from '@/lib/format';
import { reviewDocument, setVerification } from '../../actions';

export default async function VerificationDetail({ params, searchParams }: {
  params: Promise<{ id: string }>; searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;
  const { supabase } = await requireAdmin();
  const [{ data: p }, { data: pp }, { data: docsData }, { data: services }, { data: cities }] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', id).single(),
    supabase.from('provider_profiles').select('*').eq('user_id', id).single(),
    supabase.from('verification_documents').select('*').eq('provider_id', id).order('created_at', { ascending: false }),
    supabase.from('provider_services').select('indicative_price_cents, services(name_fr)').eq('provider_id', id),
    supabase.from('provider_cities').select('cities(name_fr)').eq('provider_id', id),
  ]);
  const docs = (docsData ?? []) as VerificationDocument[];
  // URLs signées courtes (5 min) générées avec la session admin : la RLS Storage autorise uniquement l'admin et le propriétaire.
  const { data: signed } = docs.length
    ? await supabase.storage.from('verification').createSignedUrls(docs.map((d) => d.storage_path), 300) : { data: [] };
  const url = (path: string) => signed?.find((s) => s.path === path)?.signedUrl ?? null;
  const missing = REQUIRED_DOC_TYPES.filter((t) => !docs.some((d) => d.doc_type === t && d.status === 'approved'));

  return (
    <div className="stack">
      <h1>{p?.full_name ?? 'Prestataire'} <Badge status={pp?.verification_status ?? 'pending'} /></h1>
      {error ? <p className="alert" role="alert">{decodeURIComponent(error)}</p> : null}
      <div className="card">
        <p><strong>Téléphone :</strong> {p?.phone ?? '—'} · <strong>Expérience :</strong> {pp?.experience_years} an(s)</p>
        <p><strong>Services :</strong> {(services ?? []).map((s: any) => s.services?.name_fr).join(', ') || '—'}</p>
        <p><strong>Villes :</strong> {(cities ?? []).map((c: any) => c.cities?.name_fr).join(', ') || '—'}</p>
        <p className="muted">{pp?.bio}</p>
        {pp?.rejection_reason ? <p className="alert">Dernier motif : {pp.rejection_reason}</p> : null}
      </div>

      <h2>Documents</h2>
      <div className="docs">
        {docs.map((d) => {
          const u = url(d.storage_path);
          return (
            <div key={d.id} className="card stack">
              <div className="row" style={{ justifyContent: 'space-between' }}><strong>{DOC_FR[d.doc_type]}</strong><Badge status={d.status} /></div>
              {u ? (d.storage_path.endsWith('.pdf')
                ? <a className="btn btn-secondary" href={u} target="_blank" rel="noreferrer">Ouvrir le PDF</a>
                // eslint-disable-next-line @next/next/no-img-element
                : <a href={u} target="_blank" rel="noreferrer"><img src={u} alt={DOC_FR[d.doc_type]} /></a>)
                : <p className="muted">Fichier indisponible</p>}
              <span className="muted">Déposé le {fmtDate(d.created_at)}</span>
              {d.note ? <span className="muted">Note : {d.note}</span> : null}
              <form action={reviewDocument} className="stack">
                <input type="hidden" name="doc" value={d.id} /><input type="hidden" name="provider" value={id} />
                <input name="note" placeholder="Note (obligatoire si refus)" aria-label="Note" />
                <div className="row">
                  <button className="btn" name="status" value="approved">Valider</button>
                  <button className="btn btn-danger" name="status" value="rejected">Refuser</button>
                </div>
              </form>
            </div>
          );
        })}
        {docs.length === 0 ? <p className="muted">Aucun document déposé.</p> : null}
      </div>

      <div className="card stack">
        <h2>Décision</h2>
        {missing.length ? <p className="notice">Documents obligatoires non validés : {missing.map((m) => DOC_FR[m]).join(', ')}</p> : null}
        <form action={setVerification} className="stack">
          <input type="hidden" name="provider" value={id} />
          <label>Motif (obligatoire pour un refus ou une suspension)<textarea name="reason" /></label>
          <div className="row">
            <button className="btn" name="status" value="verified" disabled={missing.length > 0}>Valider le prestataire</button>
            <button className="btn btn-danger" name="status" value="rejected">Rejeter</button>
            <button className="btn btn-secondary" name="status" value="suspended">Suspendre</button>
          </div>
        </form>
      </div>
    </div>
  );
}
