import { redirect } from 'next/navigation';
import { supabaseServer } from '@/lib/supabase';

async function signIn(formData: FormData) {
  'use server';
  const supabase = await supabaseServer();
  const { error } = await supabase.auth.signInWithPassword({
    email: String(formData.get('email') ?? ''), password: String(formData.get('password') ?? ''),
  });
  if (error) redirect('/login?error=credentials');
  redirect('/');
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <main style={{ display: 'grid', placeItems: 'center', minHeight: '100vh', padding: 16 }}>
      <form action={signIn} className="card stack" style={{ width: 360 }}>
        <div className="brand"><i>W</i> Wasla Admin</div>
        {error ? <p className="alert" role="alert">{error === 'forbidden' ? 'Accès réservé aux administrateurs.' : 'Identifiants incorrects.'}</p> : null}
        <label>E-mail<input name="email" type="email" required autoComplete="email" /></label>
        <label>Mot de passe<input name="password" type="password" required autoComplete="current-password" /></label>
        <button className="btn" type="submit">Se connecter</button>
      </form>
    </main>
  );
}
