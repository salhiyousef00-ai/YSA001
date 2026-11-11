import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { Stack, router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { toCents } from '@wasla/shared';
import { Ionicons } from '@expo/vector-icons';
import { Banner, Body, Button, Card, Chip, Field, H2, Row, Screen } from '@/components/ui';
import { isIsoDate } from '@/lib/format';
import { uploadFile } from '@/lib/storage';
import { errorKey, supabase } from '@/lib/supabase';
import { useMe } from '@/providers/AuthProvider';
import { useLocalized, useRefData } from '@/providers/RefDataProvider';
import { colors, radius, space } from '@/theme';

export default function NewRequest() {
  const { t } = useTranslation();
  const { uid, clientProfile } = useMe();
  const { services, cities } = useRefData();
  const loc = useLocalized();
  const [serviceId, setServiceId] = useState<string | null>(null);
  const [cityId, setCityId] = useState<number | null>(clientProfile?.origin_city_id ?? null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [budget, setBudget] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [photos, setPhotos] = useState<ImagePicker.ImagePickerAsset[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dateError = (start && !isIsoDate(start)) || (end && !isIsoDate(end)) ? t('request.invalidDate') : null;
  const valid = !!serviceId && !!cityId && title.trim().length >= 3 && !dateError;

  const pick = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.6, allowsMultipleSelection: true, selectionLimit: 6 });
    if (!res.canceled) setPhotos((p) => [...p, ...res.assets].slice(0, 6));
  };

  const submit = async (draft: boolean) => {
    setLoading(true); setError(null);
    try {
      const { data, error: e } = await supabase.from('requests').insert({
        client_id: uid, service_id: serviceId, city_id: cityId, title: title.trim(), description: description.trim(),
        budget_cents: budget ? toCents(Number(budget.replace(',', '.'))) : null,
        start_date: start || null, end_date: end || null, status: draft ? 'draft' : 'open',
      }).select('id').single();
      if (e) throw e;
      const id = (data as { id: string }).id;
      for (const p of photos) {
        const path = await uploadFile('request-photos', id, p.uri, p.mimeType ?? 'image/jpeg');
        const r = await supabase.from('request_photos').insert({ request_id: id, storage_path: path });
        if (r.error) throw r.error;
      }
      router.replace(`/request/${id}`);
    } catch (e) {
      setError(t(`errors.${errorKey(e)}` as never, { defaultValue: t('errors.unknown') }));
    } finally { setLoading(false); }
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: t('request.new') }} />
      <H2>{t('request.service')}</H2>
      {services.map((s) => (
        <Card key={s.id} onPress={() => setServiceId(s.id)} accessibilityLabel={loc(s, 'name')}
          style={serviceId === s.id ? { borderColor: colors.primary, borderWidth: 2 } : undefined}>
          <Row style={{ justifyContent: 'space-between', flexWrap: 'nowrap' }}>
            <View style={{ flex: 1 }}>
              <Body style={{ fontWeight: '600' }}>{loc(s, 'name')}</Body>
              <Body muted small>{loc(s, 'description')}</Body>
            </View>
            <Ionicons name={serviceId === s.id ? 'radio-button-on' : 'radio-button-off'} size={22} color={colors.primary} />
          </Row>
        </Card>
      ))}
      <H2>{t('request.city')}</H2>
      <Row>{cities.map((c) => <Chip key={c.id} label={loc(c, 'name')} selected={cityId === c.id} onPress={() => setCityId(c.id)} />)}</Row>
      <Field label={t('request.title')} value={title} onChangeText={setTitle} placeholder={t('request.titlePlaceholder')} maxLength={140} />
      <Field label={t('request.description')} value={description} onChangeText={setDescription} multiline placeholder={t('request.descriptionPlaceholder')} maxLength={5000} />
      <Field label={t('request.budget')} value={budget} onChangeText={(v) => setBudget(v.replace(/[^\d.,]/g, ''))} keyboardType="decimal-pad" />
      <Row style={{ flexWrap: 'nowrap' }}>
        <View style={{ flex: 1 }}><Field label={t('request.startDate')} value={start} onChangeText={setStart} placeholder="2026-12-01" /></View>
        <View style={{ flex: 1 }}><Field label={t('request.endDate')} value={end} onChangeText={setEnd} placeholder="2027-01-15" /></View>
      </Row>
      {dateError ? <Body small style={{ color: colors.danger }}>{dateError}</Body> : null}
      <H2>{t('request.photos')} <Body muted small>({t('common.optional')})</Body></H2>
      <Row>
        {photos.map((p, i) => (
          <Pressable key={p.uri} accessibilityLabel={t('common.delete')} onPress={() => setPhotos((x) => x.filter((_, j) => j !== i))}>
            <Image source={{ uri: p.uri }} style={{ width: 80, height: 80, borderRadius: radius.sm }} />
          </Pressable>
        ))}
        {photos.length < 6 ? <Button variant="secondary" icon="image-outline" title={t('request.addPhoto')} onPress={pick} /> : null}
      </Row>
      {error ? <Banner tone="danger">{error}</Banner> : null}
      <View style={{ gap: space.sm }}>
        <Button title={t('request.publish')} onPress={() => void submit(false)} disabled={!valid} loading={loading} />
        <Button variant="ghost" title={t('request.saveDraft')} onPress={() => void submit(true)} disabled={!valid || loading} />
      </View>
    </Screen>
  );
}
