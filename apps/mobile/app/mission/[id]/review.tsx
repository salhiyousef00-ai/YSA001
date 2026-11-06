import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Banner, Body, Button, Card, Field, H2, Screen } from '@/components/ui';
import { Stars } from '@/components/Stars';
import { errorKey, supabase } from '@/lib/supabase';
import { useMe } from '@/providers/AuthProvider';

export default function ReviewScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { uid } = useMe();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const submit = async () => {
    setLoading(true); setError(null);
    const { data: m } = await supabase.from('missions').select('provider_id').eq('id', id).single();
    // La RLS n'autorise l'avis que si la mission est terminée et appartient au client (un seul avis par mission)
    const { error: e } = await supabase.from('reviews').insert({
      mission_id: id, client_id: uid, provider_id: (m as { provider_id: string } | null)?.provider_id, rating, comment: comment.trim() || null,
    });
    setLoading(false);
    if (e) { setError(t(`errors.${errorKey(e)}` as never, { defaultValue: t('errors.unknown') })); return; }
    setDone(true);
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: t('review.title') }} />
      {done ? (
        <>
          <Banner tone="success" icon="heart">{t('review.thanks')}</Banner>
          <Button title={t('common.done')} onPress={() => router.back()} />
        </>
      ) : (
        <>
          <Card>
            <H2>{t('review.rating')}</H2>
            <Stars value={rating} onChange={setRating} size={36} />
            <Body muted small>{rating ? t('review.stars', { count: rating }) : ' '}</Body>
          </Card>
          <Field label={t('review.comment')} value={comment} onChangeText={setComment} multiline maxLength={2000} />
          {error ? <Banner tone="danger">{error}</Banner> : null}
          <Button title={t('review.submit')} onPress={submit} disabled={rating < 1} loading={loading} />
        </>
      )}
    </Screen>
  );
}
