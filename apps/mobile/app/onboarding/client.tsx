import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Locale } from '@wasla/shared';
import { Banner, Body, Button, Chip, Field, H2, Row, Screen } from '@/components/ui';
import { LanguagePicker } from '@/components/LanguagePicker';
import { COUNTRIES } from '@/lib/countries';
import { errorKey, supabase } from '@/lib/supabase';
import { useMe } from '@/providers/AuthProvider';
import { useLocalized, useRefData } from '@/providers/RefDataProvider';

export default function ClientOnboarding() {
  const { t, i18n } = useTranslation();
  const { uid, profile, clientProfile, refresh } = useMe();
  const { cities } = useRefData();
  const loc = useLocalized();
  const [name, setName] = useState(profile.full_name ?? '');
  const [country, setCountry] = useState<string | null>(clientProfile?.residence_country ?? null);
  const [city, setCity] = useState<number | null>(clientProfile?.origin_city_id ?? null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const l = i18n.language as Locale;

  const submit = async () => {
    setLoading(true); setError(null);
    try {
      const r1 = await supabase.from('profiles').update({ full_name: name.trim(), locale: l }).eq('id', uid);
      if (r1.error) throw r1.error;
      const r2 = await supabase.from('client_profiles').upsert({ user_id: uid, residence_country: country, origin_city_id: city });
      if (r2.error) throw r2.error;
      const r3 = await supabase.rpc('complete_onboarding');
      if (r3.error) throw r3.error;
      await refresh();
    } catch (e) {
      setError(t(`errors.${errorKey(e)}` as never, { defaultValue: t('errors.unknown') }));
    } finally { setLoading(false); }
  };

  return (
    <Screen>
      <Field label={t('onboarding.fullName')} value={name} onChangeText={setName} autoComplete="name" textContentType="name" />
      <H2>{t('onboarding.residenceCountry')}</H2>
      <Row>{COUNTRIES.map((c) => <Chip key={c.code} label={c[l]} selected={country === c.code} onPress={() => setCountry(c.code)} />)}</Row>
      <H2>{t('onboarding.originCity')}</H2>
      <Row>{cities.map((c) => <Chip key={c.id} label={loc(c, 'name')} selected={city === c.id} onPress={() => setCity(c.id)} />)}</Row>
      <H2>{t('onboarding.language')}</H2>
      <LanguagePicker />
      <Body muted small>{t('profile.privacy')}</Body>
      {error ? <Banner tone="danger">{error}</Banner> : null}
      <Button title={t('onboarding.finish')} onPress={submit} loading={loading} disabled={name.trim().length < 2 || !country} />
    </Screen>
  );
}
