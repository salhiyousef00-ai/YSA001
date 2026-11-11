import { Ionicons } from '@expo/vector-icons';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { DEFAULT_COMMISSION_RATE, fromCents, splitRelease, toCents, type Quote } from '@wasla/shared';
import { Banner, Body, Button, Card, Field, H2, Money, Row, Screen } from '@/components/ui';
import { errorKey, supabase } from '@/lib/supabase';
import { useMe } from '@/providers/AuthProvider';
import { colors, space } from '@/theme';

interface Draft { title: string; amount: string }

export default function QuoteEditor() {
  const { t } = useTranslation();
  const { requestId } = useLocalSearchParams<{ requestId: string }>();
  const { uid } = useMe();
  const [message, setMessage] = useState('');
  const [items, setItems] = useState<Draft[]>([{ title: '', amount: '' }]);
  const [rate, setRate] = useState(DEFAULT_COMMISSION_RATE);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const [s, q] = await Promise.all([
        supabase.from('platform_settings').select('value').eq('key', 'commission_rate').maybeSingle(),
        supabase.from('quotes').select('*').eq('request_id', requestId).eq('provider_id', uid).maybeSingle(),
      ]);
      const v = Number((s.data as { value: unknown } | null)?.value);
      if (Number.isFinite(v)) setRate(v);
      const existing = q.data as Quote | null;
      if (existing) {
        setMessage(existing.message);
        setItems(existing.proposed_milestones.map((m) => ({ title: m.title, amount: String(fromCents(m.amount_cents)) })));
      }
    })();
  }, [requestId, uid]);

  const cents = items.map((i) => { const n = Number(i.amount.replace(',', '.')); return Number.isFinite(n) && n > 0 ? toCents(n) : 0; });
  const total = cents.reduce((a, b) => a + b, 0);
  const valid = items.length > 0 && items.every((i, k) => i.title.trim() && cents[k]! > 0);
  const net = total > 0 ? splitRelease(total, rate).payout : 0;

  const update = (k: number, patch: Partial<Draft>) => setItems((xs) => xs.map((x, i) => (i === k ? { ...x, ...patch } : x)));

  const submit = async () => {
    setLoading(true); setError(null);
    const { error: e } = await supabase.rpc('submit_quote', {
      p_request: requestId, p_message: message.trim(),
      p_milestones: items.map((i, k) => ({ title: i.title.trim(), amount_cents: cents[k] })),
    });
    setLoading(false);
    if (e) { setError(t(`errors.${errorKey(e)}` as never, { defaultValue: t('errors.unknown') })); return; }
    router.back();
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: t('quote.new') }} />
      <Field label={t('quote.message')} value={message} onChangeText={setMessage} multiline maxLength={3000} />
      <H2>{t('quote.milestones')}</H2>
      <Body muted small>{t('quote.milestonesHint')}</Body>
      {items.map((it, k) => (
        <Card key={k}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Body style={{ fontWeight: '700' }}>#{k + 1}</Body>
            {items.length > 1 ? (
              <Pressable accessibilityRole="button" accessibilityLabel={t('common.delete')} hitSlop={10}
                onPress={() => setItems((xs) => xs.filter((_, i) => i !== k))}>
                <Ionicons name="trash-outline" size={20} color={colors.danger} />
              </Pressable>
            ) : null}
          </Row>
          <Field label={t('quote.milestoneTitle')} value={it.title} onChangeText={(v) => update(k, { title: v })} maxLength={140} />
          <Field label={t('quote.amount')} value={it.amount} keyboardType="decimal-pad" onChangeText={(v) => update(k, { amount: v.replace(/[^\d.,]/g, '') })} />
        </Card>
      ))}
      {items.length < 20 ? <Button variant="secondary" icon="add" title={t('quote.addMilestone')} onPress={() => setItems((xs) => [...xs, { title: '', amount: '' }])} /> : null}
      <Card>
        <Row style={{ justifyContent: 'space-between' }}><H2>{t('quote.total')}</H2><Money cents={total} size="amount" /></Row>
        <Body muted small>{t('quote.youReceive', { amount: (net / 100).toFixed(2) + ' MAD', rate: Math.round(rate * 100) })}</Body>
      </Card>
      {error ? <Banner tone="danger">{error}</Banner> : null}
      <View style={{ gap: space.sm }}>
        <Button title={t('quote.submit')} onPress={submit} disabled={!valid} loading={loading} />
      </View>
    </Screen>
  );
}
