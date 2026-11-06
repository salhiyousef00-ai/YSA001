import { router, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import type { Quote, ServiceRequest } from '@wasla/shared';
import { Banner, Body, Button, Card, Empty, ErrorState, H2, Money, Row, Screen } from '@/components/ui';
import { QuoteStatusPill } from '@/components/status';
import { must, useAsync } from '@/hooks/useAsync';
import { fmtDate } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import { useMe } from '@/providers/AuthProvider';
import { useRefData } from '@/providers/RefDataProvider';

export default function JobsTab() {
  const { t } = useTranslation();
  const { uid, providerProfile } = useMe();
  const { serviceName, cityName } = useRefData();
  const verified = providerProfile?.verification_status === 'verified';

  const { data, loading, error, reload } = useAsync(async () => {
    // La RLS ne renvoie que les demandes ouvertes de mes villes/services (si je suis vérifié) et celles où j'ai fait un devis.
    const [requests, quotes] = await Promise.all([
      must(supabase.from('requests').select('*').in('status', ['open', 'quoted']).order('created_at', { ascending: false })) as Promise<ServiceRequest[]>,
      must(supabase.from('quotes').select('*').eq('provider_id', uid)) as Promise<Quote[]>,
    ]);
    return { requests, quotes };
  }, [uid]);
  useFocusEffect(useCallback(() => { void reload(); }, [reload]));

  const quoteFor = (rid: string) => data?.quotes.find((q) => q.request_id === rid);

  return (
    <Screen refreshing={loading} onRefresh={reload}>
      {!verified ? (
        <Banner tone="warning" icon="shield-outline"
          action={<Button variant="secondary" title={t('home.verifyCta')} onPress={() => router.push('/verification')} />}>
          {t('home.verifyBanner')}
        </Banner>
      ) : null}
      <H2>{t('request.available')}</H2>
      {error ? <ErrorState onRetry={reload} /> : null}
      {!loading && (data?.requests ?? []).length === 0 ? <Empty icon="search-outline" text={t('request.noAvailable')} /> : null}
      {(data?.requests ?? []).map((r) => {
        const q = quoteFor(r.id);
        return (
          <Card key={r.id} onPress={() => router.push(`/request/${r.id}`)} accessibilityLabel={r.title}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Body muted small>{serviceName(r.service_id)} · {cityName(r.city_id)}</Body>
              {q ? <QuoteStatusPill status={q.status} /> : null}
            </Row>
            <H2>{r.title}</H2>
            <Body small>{r.description.length > 140 ? `${r.description.slice(0, 140)}…` : r.description}</Body>
            <Row style={{ justifyContent: 'space-between' }}>
              <Body muted small>{fmtDate(r.start_date ?? r.created_at)}</Body>
              {r.budget_cents ? <Money cents={r.budget_cents} /> : null}
            </Row>
          </Card>
        );
      })}
    </Screen>
  );
}
