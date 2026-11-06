import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Stack, useLocalSearchParams } from 'expo-router';
import { Linking, Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { Report, ReportMedia } from '@wasla/shared';
import { Body, Button, Card, Empty, ErrorState, Loading, Row, Screen } from '@/components/ui';
import { must, useAsync } from '@/hooks/useAsync';
import { fmtDateTime } from '@/lib/format';
import { signedUrls } from '@/lib/storage';
import { supabase } from '@/lib/supabase';
import { colors, radius, space } from '@/theme';

export default function ReportView() {
  const { t } = useTranslation();
  const { milestoneId } = useLocalSearchParams<{ milestoneId: string }>();
  const { data, loading, error, reload } = useAsync(async () => {
    const reports = await must(supabase.from('reports').select('*, report_media(*)').eq('milestone_id', milestoneId)
      .order('created_at', { ascending: false })) as (Report & { report_media: ReportMedia[] })[];
    const urls = await signedUrls('reports', reports.flatMap((r) => r.report_media.map((m) => m.storage_path)), 1800);
    return { reports, urls };
  }, [milestoneId]);

  if (loading && !data) return <Loading />;
  if (error || !data) return <ErrorState onRetry={reload} />;
  const mapUrl = (m: ReportMedia) => `https://www.openstreetmap.org/?mlat=${m.latitude}&mlon=${m.longitude}#map=18/${m.latitude}/${m.longitude}`;

  return (
    <Screen refreshing={loading} onRefresh={reload}>
      <Stack.Screen options={{ title: t('report.title') }} />
      {data.reports.length === 0 ? <Empty text={t('common.empty')} /> : null}
      {data.reports.map((r) => (
        <Card key={r.id}>
          <Body muted small>{fmtDateTime(r.created_at)}</Body>
          <Body>{r.body}</Body>
          {r.report_media.map((m) => {
            const url = data.urls[m.storage_path];
            return (
              <View key={m.id} style={{ gap: space.xs }}>
                {m.kind === 'photo' && url ? (
                  <Image source={{ uri: url }} style={{ width: '100%', aspectRatio: 4 / 3, borderRadius: radius.md }} contentFit="cover"
                    accessibilityLabel={t('report.capturedAt', { date: fmtDateTime(m.captured_at) })} />
                ) : (
                  <Pressable accessibilityRole="button" onPress={() => url && Linking.openURL(url)}
                    style={{ height: 120, borderRadius: radius.md, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name="play-circle" size={48} color={colors.primary} />
                  </Pressable>
                )}
                <Row>
                  <Ionicons name="time-outline" size={14} color={colors.textMuted} />
                  <Body muted small>{t('report.capturedAt', { date: fmtDateTime(m.captured_at) })}</Body>
                </Row>
                <Row>
                  <Ionicons name="location-outline" size={14} color={colors.textMuted} />
                  <Body muted small>{m.latitude.toFixed(5)}, {m.longitude.toFixed(5)}{m.accuracy_m ? ` (± ${Math.round(m.accuracy_m)} m)` : ''}</Body>
                </Row>
                <Button variant="ghost" icon="map-outline" title={t('report.openMap')} onPress={() => Linking.openURL(mapUrl(m))} />
              </View>
            );
          })}
        </Card>
      ))}
    </Screen>
  );
}
