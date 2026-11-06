import { Stack, router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { formatMAD, type Milestone, type Mission, type Profile, type Review, type Transaction } from '@wasla/shared';
import { Banner, Body, Button, Card, Divider, ErrorState, Field, H2, ListItem, Loading, Money, Row, Screen, Title } from '@/components/ui';
import { MilestoneStatusPill, MissionStatusPill } from '@/components/status';
import { must, useAsync } from '@/hooks/useAsync';
import { fmtDate } from '@/lib/format';
import { milestoneActions } from '@/lib/milestoneActions';
import { errorKey, supabase } from '@/lib/supabase';
import { useMe } from '@/providers/AuthProvider';
import { useRefData } from '@/providers/RefDataProvider';
import { colors, space } from '@/theme';

export default function MissionDetail() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { uid, profile } = useMe();
  const { serviceName } = useRefData();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [disputeFor, setDisputeFor] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [info, setInfo] = useState<string | null>(null);

  const { data, loading, error: loadError, reload } = useAsync(async () => {
    const mission = await must(supabase.from('missions').select('*').eq('id', id).single()) as Mission;
    const [milestones, txs, counterpart, review] = await Promise.all([
      must(supabase.from('milestones').select('*').eq('mission_id', id).order('position')) as Promise<Milestone[]>,
      must(supabase.from('transactions').select('*').eq('mission_id', id)) as Promise<Transaction[]>,
      must(supabase.from('profiles').select('id, full_name, phone, avatar_url')
        .eq('id', mission.client_id === uid ? mission.provider_id : mission.client_id).maybeSingle()) as Promise<Pick<Profile, 'id' | 'full_name' | 'phone'> | null>,
      must(supabase.from('reviews').select('*').eq('mission_id', id).maybeSingle()) as Promise<Review | null>,
    ]);
    return { mission, milestones, txs, counterpart, review };
  }, [id]);
  useFocusEffect(useCallback(() => { void reload(); }, [reload]));

  // Rafraîchissement en temps réel des étapes (rapport envoyé, validation…)
  useEffect(() => {
    const ch = supabase.channel(`mission-${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'milestones', filter: `mission_id=eq.${id}` }, () => void reload())
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [id, reload]);

  if (loading && !data) return <Loading />;
  if (loadError || !data) return <ErrorState onRetry={reload} />;
  const { mission: m, milestones, txs, counterpart, review } = data;
  const role = profile.role === 'provider' ? 'provider' : 'client';
  const active = m.status === 'in_progress' || m.status === 'disputed';
  const sum = (type: Transaction['type']) => txs.filter((x) => x.type === type).reduce((a, x) => a + x.amount_cents, 0);
  const inEscrow = sum('deposit') - sum('release') - sum('commission') - sum('refund');

  const rpc = async (key: string, fn: string, args: Record<string, unknown>, success?: string) => {
    setBusy(key); setError(null); setInfo(null);
    const { error: e } = await supabase.rpc(fn, args);
    setBusy(null);
    if (e) { setError(t(`errors.${errorKey(e)}` as never, { defaultValue: t('errors.unknown') })); return false; }
    if (success) setInfo(success);
    await reload();
    return true;
  };

  const confirm = (title: string, body: string, onOk: () => void) =>
    Alert.alert(title, body, [{ text: t('common.cancel'), style: 'cancel' }, { text: t('common.confirm'), onPress: onOk }]);

  const hint = (s: Milestone['status']) => {
    if (s === 'pending') return role === 'client' ? null : t('mission.waitingFunding');
    if (s === 'funded') return role === 'provider' ? null : t('mission.waitingReport');
    if (s === 'submitted') return role === 'client' ? t('mission.waitingValidation') : t('mission.waitingClient');
    return null;
  };

  return (
    <Screen refreshing={loading} onRefresh={reload}>
      <Stack.Screen options={{ title: t('mission.title') }} />
      <MissionStatusPill status={m.status} />
      <Title sub={serviceName(m.service_id)}>{m.title}</Title>

      <Card>
        <Row style={{ justifyContent: 'space-between' }}>
          <View><Body muted small>{t('mission.inEscrow')}</Body><Money cents={inEscrow} size="amount" /></View>
          <View style={{ alignItems: 'flex-end' }}><Body muted small>{t('mission.released')}</Body><Money cents={sum('release') + sum('commission')} size="h3" /></View>
        </Row>
        <Body muted small>{t('mission.escrowExplainer')}</Body>
        <Body muted small>{t('mission.commission', { rate: Math.round(Number(m.commission_rate) * 100) })}</Body>
      </Card>

      <Card>
        <ListItem icon="person-outline" title={counterpart?.full_name ?? '—'}
          subtitle={role === 'client' ? t('mission.provider') : t('mission.client')}
          onPress={role === 'client' ? () => router.push(`/provider/${m.provider_id}`) : undefined} />
        <Divider />
        <ListItem icon="chatbubbles-outline" title={t('mission.chat')} onPress={() => router.push(`/mission/${m.id}/chat`)} />
      </Card>

      {info ? <Banner tone="success" icon="checkmark-circle">{info}</Banner> : null}
      {error ? <Banner tone="danger">{error}</Banner> : null}

      <H2>{t('mission.milestones')}</H2>
      {milestones.map((ms) => {
        const actions = milestoneActions(ms.status, role, active);
        const amount = formatMAD(ms.amount_cents);
        return (
          <Card key={ms.id}>
            <Row style={{ justifyContent: 'space-between' }}>
              <MilestoneStatusPill status={ms.status} />
              <Money cents={ms.amount_cents} size="h3" />
            </Row>
            <Body style={{ fontWeight: '600' }}>{ms.position}. {ms.title}</Body>
            {ms.due_date ? <Body muted small>{fmtDate(ms.due_date)}</Body> : null}
            {hint(ms.status) ? <Body muted small>{hint(ms.status)}</Body> : null}
            <View style={{ gap: space.sm }}>
              {actions.includes('fund') ? (
                <Button icon="lock-closed-outline" title={t('mission.fund', { amount })} loading={busy === `fund-${ms.id}`}
                  onPress={() => confirm(t('mission.fund', { amount }), t('mission.fundConfirm', { amount }),
                    () => void rpc(`fund-${ms.id}`, 'fund_milestone', { p_milestone: ms.id }))} />
              ) : null}
              {actions.includes('report') ? (
                <Button icon="camera-outline" title={t('mission.submitReport')}
                  onPress={() => router.push({ pathname: '/mission/[id]/report', params: { id: m.id, milestone: ms.id } })} />
              ) : null}
              {actions.includes('view') ? (
                <Button variant="secondary" icon="images-outline" title={t('mission.viewReport')} onPress={() => router.push(`/report/${ms.id}`)} />
              ) : null}
              {actions.includes('approve') ? (
                <Button icon="checkmark-done" title={t('mission.approve')} loading={busy === `approve-${ms.id}`}
                  onPress={() => confirm(t('mission.approve'), t('mission.approveConfirm', { amount }),
                    () => void rpc(`approve-${ms.id}`, 'approve_milestone', { p_milestone: ms.id }))} />
              ) : null}
              {actions.includes('dispute') ? (
                disputeFor === ms.id ? (
                  <View style={{ gap: space.sm }}>
                    <Field label={t('mission.disputeReason')} value={reason} onChangeText={setReason} multiline maxLength={3000} />
                    <Button variant="danger" title={t('mission.dispute')} disabled={reason.trim().length < 5} loading={busy === `dispute-${ms.id}`}
                      onPress={async () => {
                        if (await rpc(`dispute-${ms.id}`, 'dispute_milestone', { p_milestone: ms.id, p_reason: reason.trim() }, t('mission.disputeSent'))) {
                          setDisputeFor(null); setReason('');
                        }
                      }} />
                  </View>
                ) : <Button variant="danger" icon="flag-outline" title={t('mission.dispute')} onPress={() => setDisputeFor(ms.id)} />
              ) : null}
            </View>
          </Card>
        );
      })}

      {m.status === 'completed' && role === 'client' && !review ? (
        <Button icon="star-outline" title={t('mission.review')} onPress={() => router.push(`/mission/${m.id}/review`)} />
      ) : null}
      {role === 'client' && m.status === 'in_progress' ? (
        <Button variant="ghost" title={t('mission.cancel')} loading={busy === 'cancel'}
          onPress={() => confirm(t('mission.cancel'), t('mission.cancelConfirm'), () => void rpc('cancel', 'cancel_mission', { p_mission: m.id }))} />
      ) : null}
      <Body muted small style={{ color: colors.textMuted }}>{t('wallet.simulated')}</Body>
    </Screen>
  );
}
