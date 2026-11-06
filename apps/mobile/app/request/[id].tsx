import { Image } from 'expo-image';
import { Stack, router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { PublicProviderProfile, Quote, ServiceRequest } from '@wasla/shared';
import { Banner, Body, Button, Card, Divider, Empty, ErrorState, H2, Loading, Money, Row, Screen, Title } from '@/components/ui';
import { MissionStatusPill, QuoteStatusPill } from '@/components/status';
import { ProviderBadges } from '@/components/Badges';
import { Stars } from '@/components/Stars';
import { must, useAsync } from '@/hooks/useAsync';
import { fmtDate } from '@/lib/format';
import { signedUrls } from '@/lib/storage';
import { errorKey, supabase } from '@/lib/supabase';
import { useMe } from '@/providers/AuthProvider';
import { useRefData } from '@/providers/RefDataProvider';
import { radius, space } from '@/theme';

export default function RequestDetail() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { uid, profile } = useMe();
  const { serviceName, cityName } = useRefData();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const isClient = profile.role === 'client';

  const { data, loading, error: loadError, reload } = useAsync(async () => {
    const request = await must(supabase.from('requests').select('*').eq('id', id).single()) as ServiceRequest;
    const [quotes, photos, mission] = await Promise.all([
      must(supabase.from('quotes').select('*').eq('request_id', id).order('total_cents')) as Promise<Quote[]>,
      must(supabase.from('request_photos').select('storage_path').eq('request_id', id)) as Promise<{ storage_path: string }[]>,
      supabase.from('missions').select('id').eq('request_id', id).maybeSingle(),
    ]);
    const providerIds = quotes.map((q) => q.provider_id);
    const providers = providerIds.length
      ? await must(supabase.from('public_provider_profiles').select('*').in('user_id', providerIds)) as PublicProviderProfile[] : [];
    const urls = await signedUrls('request-photos', photos.map((p) => p.storage_path));
    return { request, quotes, providers, photoUrls: Object.values(urls), missionId: (mission.data as { id: string } | null)?.id ?? null };
  }, [id]);
  useFocusEffect(useCallback(() => { void reload(); }, [reload]));

  if (loading && !data) return <Loading />;
  if (loadError || !data) return <ErrorState onRetry={reload} />;
  const { request: r, quotes, providers, photoUrls, missionId } = data;
  const myQuote = quotes.find((q) => q.provider_id === uid);

  const run = async (key: string, fn: () => PromiseLike<{ error: unknown; data?: unknown }>, after?: (d: unknown) => void) => {
    setBusy(key); setError(null);
    const { error: e, data: d } = await fn();
    setBusy(null);
    if (e) { setError(t(`errors.${errorKey(e)}` as never, { defaultValue: t('errors.unknown') })); return; }
    after ? after(d) : await reload();
  };

  const accept = (q: Quote) => Alert.alert(t('request.accept'), t('request.acceptConfirm'), [
    { text: t('common.cancel'), style: 'cancel' },
    { text: t('common.confirm'), onPress: () => void run(q.id, () => supabase.rpc('accept_quote', { p_quote: q.id }),
      (missionIdNew) => router.replace(`/mission/${missionIdNew as string}`)) },
  ]);

  return (
    <Screen refreshing={loading} onRefresh={reload}>
      <Stack.Screen options={{ title: serviceName(r.service_id) }} />
      <MissionStatusPill status={r.status} />
      <Title sub={`${serviceName(r.service_id)} · ${cityName(r.city_id)}`}>{r.title}</Title>
      <Card>
        {r.description ? <Body>{r.description}</Body> : null}
        <Row style={{ justifyContent: 'space-between' }}>
          <Body muted small>{fmtDate(r.start_date)} → {fmtDate(r.end_date)}</Body>
          {r.budget_cents ? <Money cents={r.budget_cents} /> : null}
        </Row>
        {photoUrls.length ? (
          <Row>{photoUrls.map((u) => <Image key={u} source={{ uri: u }} style={{ width: 96, height: 96, borderRadius: radius.sm }} accessibilityIgnoresInvertColors />)}</Row>
        ) : null}
      </Card>

      {missionId ? <Button icon="arrow-forward" title={t('common.seeDetails')} onPress={() => router.push(`/mission/${missionId}`)} /> : null}
      {error ? <Banner tone="danger">{error}</Banner> : null}

      {isClient ? (
        <>
          {r.status === 'draft' ? <Button title={t('request.publish')} loading={busy === 'publish'}
            onPress={() => void run('publish', () => supabase.rpc('publish_request', { p_request: r.id }))} /> : null}
          {['open', 'quoted'].includes(r.status) || r.status === 'draft' ? (
            <>
              <H2>{t('request.quotes')}</H2>
              {quotes.length === 0 ? <Empty icon="hourglass-outline" text={t('request.noQuotes')} /> : null}
              {quotes.map((q) => {
                const p = providers.find((x) => x.user_id === q.provider_id);
                return (
                  <Card key={q.id}>
                    <Row style={{ justifyContent: 'space-between' }}>
                      <H2>{p?.full_name ?? '—'}</H2>
                      <QuoteStatusPill status={q.status} />
                    </Row>
                    {p ? <Row><Stars value={Number(p.rating_avg ?? 0)} /><Body muted small>({p.rating_count})</Body></Row> : null}
                    {p ? <ProviderBadges p={p} /> : null}
                    {q.message ? <Body>{q.message}</Body> : null}
                    <Divider />
                    {q.proposed_milestones.map((m, i) => (
                      <Row key={i} style={{ justifyContent: 'space-between' }}>
                        <Body small>{i + 1}. {m.title}</Body><Money cents={m.amount_cents} muted />
                      </Row>
                    ))}
                    <Row style={{ justifyContent: 'space-between' }}>
                      <Body style={{ fontWeight: '700' }}>{t('quote.total')}</Body><Money cents={q.total_cents} size="h3" />
                    </Row>
                    <View style={{ gap: space.sm }}>
                      {p ? <Button variant="ghost" title={t('profile.publicProfile')} onPress={() => router.push(`/provider/${q.provider_id}`)} /> : null}
                      {q.status === 'pending' && r.status === 'quoted' ? (
                        <Button title={t('request.accept')} loading={busy === q.id} onPress={() => accept(q)} />
                      ) : null}
                    </View>
                  </Card>
                );
              })}
              <Button variant="danger" title={t('request.cancel')} loading={busy === 'cancel'}
                onPress={() => void run('cancel', () => supabase.rpc('cancel_request', { p_request: r.id }))} />
            </>
          ) : null}
        </>
      ) : (
        <>
          {myQuote ? (
            <Card>
              <Row style={{ justifyContent: 'space-between' }}><H2>{t('request.yourQuote')}</H2><QuoteStatusPill status={myQuote.status} /></Row>
              <Money cents={myQuote.total_cents} size="h3" />
              {myQuote.status === 'pending' ? (
                <Button variant="danger" title={t('quote.withdraw')} loading={busy === 'withdraw'}
                  onPress={() => void run('withdraw', () => supabase.rpc('withdraw_quote', { p_quote: myQuote.id }))} />
              ) : null}
            </Card>
          ) : null}
          {['open', 'quoted'].includes(r.status) && (!myQuote || ['pending', 'withdrawn'].includes(myQuote.status)) ? (
            <Button icon="create-outline" title={t('request.makeQuote')} onPress={() => router.push(`/quote/${r.id}`)} />
          ) : null}
        </>
      )}
    </Screen>
  );
}
