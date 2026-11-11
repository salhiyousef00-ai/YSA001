import Link from 'next/link';
import { requireAdmin } from '@/lib/supabase';
import { signOut } from './actions';

export const dynamic = 'force-dynamic';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await requireAdmin();
  return (
    <div className="shell">
      <nav className="side" aria-label="Navigation principale">
        <div className="brand"><i>W</i> Wasla</div>
        <Link href="/">Tableau de bord</Link>
        <Link href="/verifications">Vérifications</Link>
        <Link href="/missions">Missions</Link>
        <Link href="/disputes">Litiges</Link>
        <Link href="/users">Utilisateurs</Link>
        <Link href="/services">Services</Link>
        <Link href="/settings">Paramètres</Link>
        <div style={{ flex: 1 }} />
        <span className="muted" style={{ padding: '0 12px' }}>{profile.full_name}</span>
        <form action={signOut}><button className="btn btn-secondary" style={{ width: '100%' }}>Déconnexion</button></form>
      </nav>
      <main className="main">{children}</main>
    </div>
  );
}
