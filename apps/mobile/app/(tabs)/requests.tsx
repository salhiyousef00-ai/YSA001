import { router, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import type { ServiceRequest } from '@wasla/shared';
import { Body, Button, Card, Empty, ErrorState, H2, Money, Row, Screen } from '@/components/ui';
import { MissionStatusPill } from '@/components/status';
import { must, useAsync } from '@/hooks/useAsync';
import { fmtDate } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import { useMe } from '@/providers/AuthProvider';
import { useRefData } from '@/providers/RefDataProvider';

export default function RequestsTab() {
  const { t } = useTranslation();
  const { uid } = useMe();
  const { serviceName, cityName } = useRefData();
  const { data, loading, error, reload } = useAsync(() => must(
    supabase.from('requests').select('*, quotes(count)').eq('client_id', uid).order('created_at', { ascending: false }),
  ) as Promise<(ServiceRequest & { quotes: { count: number }[] })[]>, [uid]);
  useFocusEffect(useCallback(() => { void reload(); }, [reload]));

  return (
    <Screen refreshing={loading} onRefresh={reload}>
      <Button icon="add" title={t('request.new')} onPress={() => router.push('/request/new')} />
      {error ? <ErrorState onRetry={reload} /> : null}
      {!loading && (data ?? []).length === 0 ? <Empty icon="document-text-outline" text={t('home.noMissions')} /> : null}
      {(data ?? []).map((r) => (
        <Card key={r.id} onPress={() => router.push(`/request/${r.id}`)} accessibilityLabel={r.title}>
          <Row style={{ justifyContent: 'space-between' }}>
            <MissionStatusPill status={r.status} />
            {r.budget_cents ? <Money cents={r.budget_cents} muted /> : null}
          </Row>
          <H2>{r.title}</H2>
          <Body muted small>{serviceName(r.service_id)} · {cityName(r.city_id)} · {fmtDate(r.created_at)}</Body>
          {['open', 'quoted'].includes(r.status) ? (
            <Body small>{t('request.quotes')} : {r.quotes[0]?.count ?? 0}</Body>
          ) : null}
        </Card>
      ))}
    </Screen>
  );
}
