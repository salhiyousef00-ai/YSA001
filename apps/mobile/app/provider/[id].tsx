import { Stack, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import type { PublicProviderProfile, Review } from '@wasla/shared';
import { formatMAD } from '@wasla/shared';
import { Body, Card, Divider, Empty, ErrorState, H2, Loading, Pill, Row, Screen, Title } from '@/components/ui';
import { ProviderBadges } from '@/components/Badges';
import { Stars } from '@/components/Stars';
import { must, useAsync } from '@/hooks/useAsync';
import { supabase } from '@/lib/supabase';
import { useRefData } from '@/providers/RefDataProvider';

export default function ProviderPublicProfile() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { serviceName, cityName } = useRefData();
  const { data, loading, error, reload } = useAsync(async () => {
    const [p, r] = await Promise.all([
      must(supabase.from('public_provider_profiles').select('*').eq('user_id', id).maybeSingle()) as Promise<PublicProviderProfile | null>,
      must(supabase.from('reviews').select('*').eq('provider_id', id).order('created_at', { ascending: false }).limit(20)) as Promise<Review[]>,
    ]);
    return { p, reviews: r };
  }, [id]);

  if (loading && !data) return <Loading />;
  if (error) return <ErrorState onRetry={reload} />;
  const p = data?.p;
  if (!p) return <Screen><Empty icon="shield-outline" text={t('status.verification.pending')} /></Screen>;

  return (
    <Screen onRefresh={reload} refreshing={loading}>
      <Stack.Screen options={{ title: p.full_name ?? '' }} />
      <Title>{p.full_name}</Title>
      <Row>
        <Stars value={Number(p.rating_avg ?? 0)} />
        <Body muted small>{p.rating_avg ? `${Number(p.rating_avg).toFixed(1)} · ${p.rating_count}` : '—'}</Body>
      </Row>
      <ProviderBadges p={p} />
      <Card>
        <Body muted small>{t('badges.experience', { count: p.experience_years })}</Body>
        <Body>{p.bio}</Body>
      </Card>
      <Card>
        <H2>{t('onboarding.servicesOffered')}</H2>
        {p.services.map((s) => (
          <Row key={s.service_id} style={{ justifyContent: 'space-between' }}>
            <Body>{serviceName(s.service_id)}</Body>
            {s.indicative_price_cents != null ? (
              <Body muted small>{formatMAD(s.indicative_price_cents)} {t(`onboarding.priceUnit.${s.price_unit as 'mission'}`)}</Body>
            ) : null}
          </Row>
        ))}
        <Divider />
        <H2>{t('onboarding.citiesCovered')}</H2>
        <Row>{p.city_ids.map((c) => <Pill key={c} label={cityName(c)} />)}</Row>
      </Card>
      <H2>{t('review.title')}</H2>
      {(data?.reviews ?? []).length === 0 ? <Empty icon="chatbubble-outline" text={t('common.empty')} /> : null}
      {(data?.reviews ?? []).map((r) => (
        <Card key={r.id}>
          <Stars value={r.rating} />
          {r.comment ? <Body>{r.comment}</Body> : null}
          <Body muted small>{new Date(r.created_at).toLocaleDateString()}</Body>
        </Card>
      ))}
    </Screen>
  );
}
