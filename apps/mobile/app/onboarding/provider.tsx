import { useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { toCents } from '@wasla/shared';
import { Banner, Body, Button, Card, Chip, Field, H2, Row, Screen } from '@/components/ui';
import { ProviderCatalogEditor, type CatalogState } from '@/components/ProviderCatalogEditor';
import { errorKey, supabase } from '@/lib/supabase';
import { useMe } from '@/providers/AuthProvider';
import { space } from '@/theme';

const TOTAL = 3;

export default function ProviderOnboarding() {
  const { t } = useTranslation();
  const { uid, profile, providerProfile, refresh } = useMe();
  const [step, setStep] = useState(1);
  const [catalog, setCatalog] = useState<CatalogState>({ services: {}, cities: [] });
  const [name, setName] = useState(profile.full_name ?? '');
  const [phone, setPhone] = useState(profile.phone ?? '');
  const [bio, setBio] = useState(providerProfile?.bio ?? '');
  const [years, setYears] = useState(String(providerProfile?.experience_years ?? ''));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const serviceIds = Object.keys(catalog.services);
  const canNext = step === 1 ? serviceIds.length > 0 : step === 2 ? catalog.cities.length > 0 : name.trim().length >= 2;

  const finish = async () => {
    setLoading(true); setError(null);
    try {
      const years_n = Math.max(0, Math.min(70, parseInt(years, 10) || 0));
      const ops = [
        supabase.from('profiles').update({ full_name: name.trim(), phone: phone.trim() || null }).eq('id', uid),
        supabase.from('provider_profiles').update({ bio: bio.trim(), experience_years: years_n }).eq('user_id', uid),
        supabase.from('provider_services').delete().eq('provider_id', uid),
        supabase.from('provider_cities').delete().eq('provider_id', uid),
      ];
      for (const op of ops) { const r = await op; if (r.error) throw r.error; }
      const rs = await supabase.from('provider_services').insert(serviceIds.map((id) => {
        const s = catalog.services[id]!;
        return { provider_id: uid, service_id: id, price_unit: s.unit,
          indicative_price_cents: s.price ? toCents(Number(s.price.replace(',', '.'))) : null };
      }));
      if (rs.error) throw rs.error;
      const rc = await supabase.from('provider_cities').insert(catalog.cities.map((c) => ({ provider_id: uid, city_id: c })));
      if (rc.error) throw rc.error;
      const r = await supabase.rpc('complete_onboarding');
      if (r.error) throw r.error;
      await refresh();
    } catch (e) {
      setError(t(`errors.${errorKey(e)}` as never, { defaultValue: t('errors.unknown') }));
    } finally { setLoading(false); }
  };

  return (
    <Screen>
      <Body muted small>{t('onboarding.step', { n: step, total: TOTAL })}</Body>
      <View style={{ flexDirection: 'row', gap: space.xs }}>
        {Array.from({ length: TOTAL }, (_, i) => (
          <View key={i} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: i < step ? '#0B5D3B' : '#DCE3DF' }} />
        ))}
      </View>
      {step <= 2 ? (
        <ProviderCatalogEditor value={catalog} onChange={setCatalog} section={step === 1 ? 'services' : 'cities'} />
      ) : (
        <>
          <Field label={t('onboarding.fullName')} value={name} onChangeText={setName} autoComplete="name" />
          <Field label={t('auth.phone')} value={phone} onChangeText={setPhone} keyboardType="phone-pad" hint={t('auth.phoneHint')} />
          <Field label={t('onboarding.experienceYears')} value={years} onChangeText={(v) => setYears(v.replace(/\D/g, ''))} keyboardType="number-pad" />
          <Field label={t('onboarding.bio')} value={bio} onChangeText={setBio} multiline placeholder={t('onboarding.bioPlaceholder')} maxLength={2000} />
        </>
      )}
      {error ? <Banner tone="danger">{error}</Banner> : null}
      <Row style={{ flexWrap: 'nowrap' }}>
        {step > 1 ? <Button style={{ flex: 1 }} variant="secondary" title={t('common.back')} onPress={() => setStep(step - 1)} /> : null}
        <Button style={{ flex: 2 }} title={step < TOTAL ? t('common.continue') : t('onboarding.finish')} disabled={!canNext}
          loading={loading} onPress={() => (step < TOTAL ? setStep(step + 1) : void finish())} />
      </Row>
    </Screen>
  );
}
