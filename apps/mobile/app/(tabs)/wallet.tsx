import { router, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { Mission, Transaction } from '@wasla/shared';
import { Banner, Body, Card, Divider, Empty, ErrorState, H2, ListItem, Money, Row, Screen, type IconName } from '@/components/ui';
import { must, useAsync } from '@/hooks/useAsync';
import { fmtDateTime } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import { summarize } from '@/lib/wallet';
import { useMe } from '@/providers/AuthProvider';

const TX_ICON: Record<Transaction['type'], IconName> = {
  deposit: 'lock-closed-outline', release: 'arrow-up-circle-outline', commission: 'pricetag-outline', refund: 'arrow-undo-outline',
};

export default function WalletTab() {
  const { t } = useTranslation();
  const { profile } = useMe();
  const role = profile.role === 'provider' ? 'provider' : 'client';
  const { data, loading, error, reload } = useAsync(async () => {
    // La RLS limite aux missions dont je suis participant
    const txs = await must(supabase.from('transactions').select('*').order('created_at', { ascending: false }).limit(200)) as Transaction[];
    const missions = await must(supabase.from('missions').select('id, title')) as Pick<Mission, 'id' | 'title'>[];
    return { txs, titles: Object.fromEntries(missions.map((m) => [m.id, m.title])) as Record<string, string> };
  }, []);
  useFocusEffect(useCallback(() => { void reload(); }, [reload]));

  const visible = (data?.txs ?? []).filter((x) => role === 'client' || x.type !== 'commission');
  const s = summarize(data?.txs ?? [], role);

  return (
    <Screen refreshing={loading} onRefresh={reload}>
      <Card>
        <Row style={{ justifyContent: 'space-between' }}>
          <View><Body muted small>{t('wallet.inEscrow')}</Body><Money cents={s.inEscrow} size="amount" /></View>
          <View style={{ alignItems: 'flex-end' }}>
            <Body muted small>{role === 'provider' ? t('wallet.earned') : t('wallet.released')}</Body>
            <Money cents={role === 'provider' ? s.net : s.released} size="h3" />
          </View>
        </Row>
        {s.refunded ? <Body muted small>{t('wallet.refunded')} : {(s.refunded / 100).toFixed(2)} MAD</Body> : null}
      </Card>
      <Banner tone="info" icon="flask-outline">{t('wallet.simulated')}</Banner>
      <H2>{t('wallet.history')}</H2>
      {error ? <ErrorState onRetry={reload} /> : null}
      {!loading && visible.length === 0 ? <Empty icon="receipt-outline" text={t('wallet.none')} /> : null}
      {visible.length ? (
        <Card>
          {visible.map((x, i) => (
            <View key={x.id}>
              {i > 0 ? <Divider /> : null}
              <ListItem icon={TX_ICON[x.type]} title={t(`wallet.tx.${x.type}`)}
                subtitle={`${data?.titles[x.mission_id] ?? ''} · ${fmtDateTime(x.created_at)}`}
                right={<Money cents={x.amount_cents} />} onPress={() => router.push(`/mission/${x.mission_id}`)} />
            </View>
          ))}
        </Card>
      ) : null}
    </Screen>
  );
}
