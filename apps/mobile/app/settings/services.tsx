import { Stack, router } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { fromCents, toCents, type ProviderService } from '@wasla/shared';
import { Banner, Button, Loading, Screen } from '@/components/ui';
import { ProviderCatalogEditor, type CatalogState, type PriceUnit } from '@/components/ProviderCatalogEditor';
import { errorKey, supabase } from '@/lib/supabase';
import { useMe } from '@/providers/AuthProvider';

export default function EditServices() {
  const { t } = useTranslation();
  const { uid } = useMe();
  const [state, setState] = useState<CatalogState | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const [s, c] = await Promise.all([
        supabase.from('provider_services').select('*').eq('provider_id', uid),
        supabase.from('provider_cities').select('city_id').eq('provider_id', uid),
      ]);
      const services: CatalogState['services'] = {};
      for (const r of (s.data ?? []) as ProviderService[]) {
        services[r.service_id] = { price: r.indicative_price_cents != null ? String(fromCents(r.indicative_price_cents)) : '', unit: r.price_unit as PriceUnit };
      }
      setState({ services, cities: ((c.data ?? []) as { city_id: number }[]).map((x) => x.city_id) });
    })();
  }, [uid]);

  if (!state) return <Loading />;

  const save = async () => {
    setSaving(true); setError(null);
    try {
      for (const op of [supabase.from('provider_services').delete().eq('provider_id', uid), supabase.from('provider_cities').delete().eq('provider_id', uid)]) {
        const r = await op; if (r.error) throw r.error;
      }
      const ids = Object.keys(state.services);
      if (ids.length) {
        const r = await supabase.from('provider_services').insert(ids.map((id) => ({ provider_id: uid, service_id: id, price_unit: state.services[id]!.unit,
          indicative_price_cents: state.services[id]!.price ? toCents(Number(state.services[id]!.price.replace(',', '.'))) : null })));
        if (r.error) throw r.error;
      }
      if (state.cities.length) {
        const r = await supabase.from('provider_cities').insert(state.cities.map((c) => ({ provider_id: uid, city_id: c })));
        if (r.error) throw r.error;
      }
      router.back();
    } catch (e) {
      setError(t(`errors.${errorKey(e)}` as never, { defaultValue: t('errors.unknown') }));
    } finally { setSaving(false); }
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: t('profile.editServices') }} />
      <ProviderCatalogEditor value={state} onChange={setState} section="both" />
      {error ? <Banner tone="danger">{error}</Banner> : null}
      <Button title={t('common.save')} onPress={save} loading={saving}
        disabled={Object.keys(state.services).length === 0 || state.cities.length === 0} />
    </Screen>
  );
}
