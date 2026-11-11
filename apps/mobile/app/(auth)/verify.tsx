import { Redirect, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Banner, Button, Field, Screen, Title } from '@/components/ui';
import { supabase } from '@/lib/supabase';

export default function Verify() {
  const { t } = useTranslation();
  const { mode, target } = useLocalSearchParams<{ mode: 'email' | 'phone'; target: string }>();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resent, setResent] = useState(false);

  // Ouvert sans destinataire (lien profond, restauration d'état) : retour à la connexion.
  if (!target || (mode !== 'email' && mode !== 'phone')) return <Redirect href="/(auth)/sign-in" />;

  const verify = async () => {
    setLoading(true); setError(null);
    const { error: e } = mode === 'phone'
      ? await supabase.auth.verifyOtp({ phone: target, token: code, type: 'sms' })
      : await supabase.auth.verifyOtp({ email: target, token: code, type: 'email' });
    setLoading(false);
    if (e) setError(t('errors.otp_expired'));
    // succès : onAuthStateChange → le Gate redirige vers l'onboarding ou l'accueil
  };

  const resend = async () => {
    if (mode === 'phone') await supabase.auth.signInWithOtp({ phone: target });
    else await supabase.auth.signInWithOtp({ email: target });
    setResent(true);
  };

  return (
    <Screen>
      <Title sub={t('auth.verifySubtitle', { target })}>{t('auth.verifyTitle')}</Title>
      <Field label={t('auth.code')} value={code} onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 8))}
        keyboardType="number-pad" autoComplete="one-time-code" textContentType="oneTimeCode" maxLength={8} autoFocus />
      {error ? <Banner tone="danger" icon="alert-circle">{error}</Banner> : null}
      <Button title={t('auth.verify')} onPress={verify} loading={loading} disabled={code.length < 6} />
      <Button variant="ghost" title={t('auth.resend')} onPress={resend} disabled={resent} />
    </Screen>
  );
}
