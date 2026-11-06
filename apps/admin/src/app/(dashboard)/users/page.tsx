import type { Profile } from '@wasla/shared';
import { requireAdmin } from '@/lib/supabase';
import { Badge } from '@/components/Badge';
import { fmtDate } from '@/lib/format';
import { setSuspended } from '../actions';

const ROLE_FR: Record<string, string> = { client: 'Client', provider: 'Prestataire', admin: 'Admin' };

export default async function Users({ searchParams }: { searchParams: Promise<{ q?: string; error?: string }> }) {
  const { q, error } = await searchParams;
  const { supabase, profile: me } = await requireAdmin();
  let query = supabase.from('profiles').select('*').is('deleted_at', null).order('created_at', { ascending: false }).limit(300);
  if (q) query = query.ilike('full_name', `%${q.replace(/[%_]/g, '')}%`);
  const { data } = await query;
  const rows = (data ?? []) as Profile[];
  return (
    <div className="stack">
      <h1>Utilisateurs</h1>
      {error ? <p className="alert">{decodeURIComponent(error)}</p> : null}
      <form className="inline"><label>Recherche<input name="q" defaultValue={q} placeholder="Nom" /></label><button className="btn btn-secondary">Filtrer</button></form>
      <table>
        <thead><tr><th>Nom</th><th>Rôle</th><th>Téléphone</th><th>Inscrit</th><th>État</th><th>Action</th></tr></thead>
        <tbody>{rows.map((u) => (
          <tr key={u.id}>
            <td>{u.full_name ?? '—'}</td><td>{u.role ? ROLE_FR[u.role] : '—'}</td><td>{u.phone ?? '—'}</td><td>{fmtDate(u.created_at)}</td>
            <td>{u.is_suspended ? <Badge status="suspended" /> : <Badge status="verified" label="Actif" />}</td>
            <td>{u.id !== me.id ? (
              <form action={setSuspended} className="inline">
                <input type="hidden" name="user" value={u.id} />
                <input type="hidden" name="suspended" value={u.is_suspended ? 'false' : 'true'} />
                {!u.is_suspended ? <input name="reason" placeholder="Motif" aria-label="Motif" required /> : null}
                <button className={`btn ${u.is_suspended ? 'btn-secondary' : 'btn-danger'}`}>{u.is_suspended ? 'Réactiver' : 'Suspendre'}</button>
              </form>
            ) : null}</td>
          </tr>
        ))}</tbody>
      </table>
    </div>
  );
}
