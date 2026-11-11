import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Banner, Body, Button, Chip, Field, Row, Screen, Title } from '@/components/ui';
import { currentLocale } from '@/i18n';
import { supabase } from '@/lib/supabase';

type Mode = 'email' | 'phone';

export function normalizePhone(raw: string): string {
  const cleaned = raw.replace(/[^\d+]/g, '');
  if (cleaned.startsWith('00')) return `+${cleaned.slice(2)}`;
  if (cleaned.startsWith('0')) return `+212${cleaned.slice(1)}`; // numéro marocain local
  return cleaned.startsWith('+') ? cleaned : `+${cleaned}`;
}

export default function SignIn() {
  const { t } = useTranslation();
  const [mode, setMode] = useState<Mode>('email');
  const [usePassword, setUsePassword] = useState(false);
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const valid = mode === 'email' ? /^\S+@\S+\.\S+$/.test(email.trim()) : normalizePhone(phone).length >= 10;

  const submit = async () => {
    setLoading(true); setError(null);
    try {
      const data = { locale: currentLocale() };
      if (usePassword && mode === 'email') {
        const { error: e } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (e) throw e;
        return; // le Gate redirige
      }
      const target = mode === 'email' ? email.trim().toLowerCase() : normalizePhone(phone);
      const { error: e } = mode === 'email'
        ? await supabase.auth.signInWithOtp({ email: target, options: { shouldCreateUser: true, data } })
        : await supabase.auth.signInWithOtp({ phone: target, options: { shouldCreateUser: true, data } });
      if (e) throw e;
      router.push({ pathname: '/(auth)/verify', params: { mode, target } });
    } catch (e) {
      setError(usePassword ? t('errors.invalid_credentials') : (e as Error).message || t('errors.unknown'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen>
      <Title>{t('auth.signInTitle')}</Title>
      {!usePassword ? <Body muted small>{t('auth.newAccountHint')}</Body> : null}
      <Row>
        <Chip label={t('auth.byEmail')} selected={mode === 'email'} onPress={() => setMode('email')} />
        <Chip label={t('auth.byPhone')} selected={mode === 'phone'} onPress={() => { setMode('phone'); setUsePassword(false); }} />
      </Row>
      {mode === 'email' ? (
        <Field label={t('auth.email')} value={email} onChangeText={setEmail} autoCapitalize="none" autoComplete="email"
          keyboardType="email-address" textContentType="emailAddress" />
      ) : (
        <Field label={t('auth.phone')} hint={t('auth.phoneHint')} value={phone} onChangeText={setPhone}
          keyboardType="phone-pad" autoComplete="tel" textContentType="telephoneNumber" />
      )}
      {usePassword ? (
        <Field label={t('auth.password')} value={password} onChangeText={setPassword} secureTextEntry autoComplete="password" />
      ) : null}
      {error ? <Banner tone="danger" icon="alert-circle">{error}</Banner> : null}
      <Button title={usePassword ? t('auth.signIn') : t('auth.sendCode')} onPress={submit} loading={loading}
        disabled={!valid || (usePassword && password.length < 6)} />
      {mode === 'email' ? (
        <Button variant="ghost" title={usePassword ? t('auth.useOtp') : t('auth.usePassword')} onPress={() => setUsePassword((v) => !v)} />
      ) : null}
    </Screen>
  );
}
