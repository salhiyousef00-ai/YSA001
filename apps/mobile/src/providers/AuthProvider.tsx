import type { Session } from '@supabase/supabase-js';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { ClientProfile, Profile, ProviderProfile } from '@wasla/shared';
import { supabase } from '@/lib/supabase';

interface AuthState {
  session: Session | null;
  profile: Profile | null;
  clientProfile: ClientProfile | null;
  providerProfile: ProviderProfile | null;
  initializing: boolean;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [clientProfile, setClientProfile] = useState<ClientProfile | null>(null);
  const [providerProfile, setProviderProfile] = useState<ProviderProfile | null>(null);
  const [initializing, setInitializing] = useState(true);

  const load = useCallback(async (s: Session | null) => {
    if (!s) { setProfile(null); setClientProfile(null); setProviderProfile(null); return; }
    const uid = s.user.id;
    const [p, c, pr] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', uid).maybeSingle(),
      supabase.from('client_profiles').select('*').eq('user_id', uid).maybeSingle(),
      supabase.from('provider_profiles').select('*').eq('user_id', uid).maybeSingle(),
    ]);
    setProfile((p.data as Profile | null) ?? null);
    setClientProfile((c.data as ClientProfile | null) ?? null);
    setProviderProfile((pr.data as ProviderProfile | null) ?? null);
  }, []);

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return;
      setSession(data.session);
      await load(data.session);
      setInitializing(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      void load(s);
    });
    return () => { active = false; sub.subscription.unsubscribe(); };
  }, [load]);

  const value = useMemo<AuthState>(() => ({
    session, profile, clientProfile, providerProfile, initializing,
    refresh: () => load(session),
    signOut: async () => { await supabase.auth.signOut(); },
  }), [session, profile, clientProfile, providerProfile, initializing, load]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

/** Variante pour les écrans authentifiés : garantit session + profil. */
export function useMe() {
  const a = useAuth();
  if (!a.session || !a.profile) throw new Error('useMe used outside authenticated area');
  return { ...a, uid: a.session.user.id, profile: a.profile };
}
