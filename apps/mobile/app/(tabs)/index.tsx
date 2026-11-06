import { router, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import type { Mission } from '@wasla/shared';
import { Banner, Body, Button, Card, Empty, ErrorState, H2, Money, Row, Screen, Title } from '@/components/ui';
import { MissionStatusPill } from '@/components/status';
import { must, useAsync } from '@/hooks/useAsync';
import { supabase } from '@/lib/supabase';
import { useMe } from '@/providers/AuthProvider';
import { useRefData } from '@/providers/RefDataProvider';

export default function Home() {
  const { t } = useTranslation();
  const { uid, profile, providerProfile, signOut } = useMe();
  const { serviceName } = useRefData();
  const isProvider = profile.role === 'provider';

  const { data: missions, loading, error, reload } = useAsync(() => must(
    supabase.from('missions').select('*').or(`client_id.eq.${uid},provider_id.eq.${uid}`)
      .in('status', ['in_progress', 'disputed', 'completed']).order('created_at', { ascending: false }).limit(20),
  ) as Promise<Mission[]>, [uid]);
  useFocusEffect(useCallback(() => { void reload(); }, [reload]));

  if (profile.role === 'admin') {
    return <Screen><Banner>{t('auth.adminUseWeb')}</Banner><Button title={t('auth.signOut')} onPress={signOut} /></Screen>;
  }

  const active = (missions ?? []).filter((m) => m.status !== 'completed');
  const firstName = (profile.full_name ?? '').split(' ')[0] ?? '';
  const vs = providerProfile?.verification_status;

  return (
    <Screen refreshing={loading} onRefresh={reload}>
      <Title>{t('home.hello', { name: firstName })}</Title>
      {profile.is_suspended ? <Banner tone="danger" icon="ban">{t('home.suspendedBanner')}</Banner> : null}
      {isProvider && vs && vs !== 'verified' ? (
        <Banner tone={vs === 'pending' ? 'warning' : 'danger'} icon="shield-outline"
          action={<Button variant="secondary" title={t('home.verifyCta')} onPress={() => router.push('/verification')} />}>
          {vs === 'rejected' ? t('home.rejectedBanner', { reason: providerProfile?.rejection_reason ?? '' })
            : vs === 'suspended' ? t('home.suspendedBanner') : `${t('home.verifyBanner')} ${t('home.pendingBanner')}`}
        </Banner>
      ) : null}
      {!isProvider ? <Button icon="add" title={t('home.newRequest')} onPress={() => router.push('/request/new')} /> : null}
      <H2>{t('home.activeMissions')}</H2>
      {error ? <ErrorState onRetry={reload} /> : null}
      {!loading && active.length === 0 ? <Empty icon="briefcase-outline" text={isProvider ? t('home.providerNoMissions') : t('home.noMissions')} /> : null}
      {active.map((m) => <MissionCard key={m.id} m={m} serviceName={serviceName(m.service_id)} />)}
      {(missions ?? []).some((m) => m.status === 'completed') ? (
        <>
          <H2>{t('status.mission.completed')}</H2>
          {(missions ?? []).filter((m) => m.status === 'completed').map((m) => <MissionCard key={m.id} m={m} serviceName={serviceName(m.service_id)} />)}
        </>
      ) : null}
    </Screen>
  );
}

function MissionCard({ m, serviceName }: { m: Mission; serviceName: string }) {
  return (
    <Card onPress={() => router.push(`/mission/${m.id}`)} accessibilityLabel={m.title}>
      <Row style={{ justifyContent: 'space-between' }}>
        <MissionStatusPill status={m.status} />
        <Money cents={m.total_cents} muted />
      </Row>
      <H2>{m.title}</H2>
      <Body muted small>{serviceName}</Body>
    </Card>
  );
}
