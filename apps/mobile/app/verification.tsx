import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Stack } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { DOC_TYPES, REQUIRED_DOC_TYPES, type DocType, type VerificationDocument } from '@wasla/shared';
import { Banner, Body, Button, Card, H2, Pill, Row, Screen } from '@/components/ui';
import { VerificationPill } from '@/components/status';
import { must, useAsync } from '@/hooks/useAsync';
import { uploadFile } from '@/lib/storage';
import { errorKey, supabase } from '@/lib/supabase';
import { useMe } from '@/providers/AuthProvider';
import { colors, space } from '@/theme';

export default function VerificationScreen() {
  const { t } = useTranslation();
  const { uid, providerProfile, refresh } = useMe();
  const [busy, setBusy] = useState<DocType | 'submit' | null>(null);
  const [message, setMessage] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);

  const { data: docs, reload } = useAsync(() => must(
    supabase.from('verification_documents').select('*').eq('provider_id', uid).order('created_at', { ascending: false }),
  ) as Promise<VerificationDocument[]>, [uid]);

  const latest = (type: DocType) => docs?.find((d) => d.doc_type === type);
  const status = providerProfile?.verification_status ?? 'pending';
  const locked = status === 'verified' || status === 'suspended';

  const add = async (type: DocType, source: 'camera' | 'library') => {
    setMessage(null);
    const perm = source === 'camera' ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.7, allowsEditing: false,
      cameraType: type === 'selfie' ? ImagePicker.CameraType.front : ImagePicker.CameraType.back };
    const res = source === 'camera' ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
    const asset = res.canceled ? null : res.assets[0];
    if (!asset) return;
    setBusy(type);
    try {
      // remplace un document en attente du même type
      const prev = latest(type);
      if (prev && prev.status === 'pending' && type !== 'diploma') {
        await supabase.from('verification_documents').delete().eq('id', prev.id);
        await supabase.storage.from('verification').remove([prev.storage_path]);
      }
      const path = await uploadFile('verification', uid, asset.uri, asset.mimeType ?? 'image/jpeg', `${type}-${Date.now()}`);
      const { error } = await supabase.from('verification_documents').insert({ provider_id: uid, doc_type: type, storage_path: path });
      if (error) throw error;
      await reload();
    } catch (e) {
      setMessage({ tone: 'danger', text: t(`errors.${errorKey(e)}` as never, { defaultValue: t('errors.unknown') }) });
    } finally { setBusy(null); }
  };

  const submit = async () => {
    setBusy('submit'); setMessage(null);
    const { error } = await supabase.rpc('submit_verification');
    setBusy(null);
    if (error) setMessage({ tone: 'danger', text: t(`errors.${errorKey(error)}` as never, { defaultValue: t('errors.unknown') }) });
    else { setMessage({ tone: 'success', text: t('verification.submitted') }); await refresh(); }
  };

  const allRequired = REQUIRED_DOC_TYPES.every((d) => { const x = latest(d); return x && x.status !== 'rejected'; });

  return (
    <Screen onRefresh={reload}>
      <Stack.Screen options={{ title: t('verification.title') }} />
      <VerificationPill status={status} />
      {status === 'rejected' && providerProfile?.rejection_reason ? (
        <Banner tone="danger">{t('verification.rejectedReason', { reason: providerProfile.rejection_reason })}</Banner>
      ) : null}
      <Banner tone="primary" icon="lock-closed">{t('verification.intro')}</Banner>
      {DOC_TYPES.map((type) => {
        const d = latest(type);
        const required = REQUIRED_DOC_TYPES.includes(type);
        return (
          <Card key={type}>
            <Row style={{ justifyContent: 'space-between' }}>
              <View style={{ flex: 1, gap: 2 }}>
                <H2>{t(`verification.docs.${type}`)}</H2>
                <Body muted small>{required ? t('common.required') : t('common.optional')}</Body>
              </View>
              {d ? <Pill tone={d.status === 'approved' ? 'success' : d.status === 'rejected' ? 'danger' : 'warning'}
                icon={d.status === 'approved' ? 'checkmark-circle' : d.status === 'rejected' ? 'close-circle' : 'time-outline'}
                label={t(`status.doc.${d.status}`)} /> : <Ionicons name="ellipse-outline" size={20} color={colors.textMuted} />}
            </Row>
            {d?.status === 'rejected' && d.note ? <Body small style={{ color: colors.danger }}>{d.note}</Body> : null}
            {!locked && d?.status !== 'approved' ? (
              <Row style={{ gap: space.sm }}>
                <Button style={{ flex: 1 }} variant="secondary" icon="camera-outline" title={t('verification.takePhoto')}
                  loading={busy === type} onPress={() => void add(type, 'camera')} />
                {type !== 'selfie' ? (
                  <Button style={{ flex: 1 }} variant="ghost" icon="image-outline" title={t('verification.pickFile')}
                    disabled={busy === type} onPress={() => void add(type, 'library')} />
                ) : null}
              </Row>
            ) : null}
          </Card>
        );
      })}
      {message ? <Banner tone={message.tone}>{message.text}</Banner> : null}
      {!locked ? <Button title={t('verification.submit')} onPress={submit} disabled={!allRequired} loading={busy === 'submit'} /> : null}
    </Screen>
  );
}
