import Link from 'next/link';
import { requireAdmin } from '@/lib/supabase';
import { Badge } from '@/components/Badge';
import { fmtDate } from '@/lib/format';

export default async function VerificationQueue({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status = 'pending' } = await searchParams;
  const { supabase } = await requireAdmin();
  const { data } = await supabase.from('provider_profiles')
    .select('user_id, verification_status, updated_at, experience_years, profiles!inner(full_name, phone, created_at), verification_documents(count)')
    .eq('verification_status', status).order('updated_at');
  const rows = (data ?? []) as unknown as {
    user_id: string; verification_status: string; experience_years: number;
    profiles: { full_name: string | null; phone: string | null; created_at: string }; verification_documents: { count: number }[];
  }[];
  return (
    <>
      <h1>File de vérification</h1>
      <div className="row" style={{ marginBottom: 16 }}>
        {['pending', 'rejected', 'verified', 'suspended'].map((s) => (
          <Link key={s} href={`/verifications?status=${s}`} className={`btn ${s === status ? '' : 'btn-secondary'}`}><Badge status={s} /></Link>
        ))}
      </div>
      <table>
        <thead><tr><th>Prestataire</th><th>Téléphone</th><th>Documents</th><th>Inscrit le</th><th>Statut</th><th /></tr></thead>
        <tbody>
          {rows.length === 0 ? <tr><td colSpan={6} className="muted">Aucun dossier.</td></tr> : null}
          {rows.map((r) => (
            <tr key={r.user_id}>
              <td>{r.profiles.full_name ?? '—'}</td><td>{r.profiles.phone ?? '—'}</td>
              <td>{r.verification_documents[0]?.count ?? 0}</td><td>{fmtDate(r.profiles.created_at)}</td>
              <td><Badge status={r.verification_status} /></td>
              <td><Link className="btn btn-secondary" href={`/verifications/${r.user_id}`}>Examiner</Link></td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
