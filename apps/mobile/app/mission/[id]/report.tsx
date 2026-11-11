import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions, useMicrophonePermissions, type CameraMode } from 'expo-camera';
import { Image } from 'expo-image';
import * as Location from 'expo-location';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Banner, Body, Button, Chip, Field, H2, Row, Screen } from '@/components/ui';
import { currentFix, ProofLocationError, toMediaPayload, type CapturedProof } from '@/lib/proof';
import { uploadFile } from '@/lib/storage';
import { errorKey, supabase } from '@/lib/supabase';
import { colors, radius, space } from '@/theme';

/**
 * Rapport d'étape. Les preuves sont prises UNIQUEMENT via la caméra intégrée (aucun accès à la galerie) ;
 * l'horodatage et la position GPS sont capturés au moment de la prise et vérifiés côté serveur (fraîcheur).
 */
export default function ReportCapture() {
  const { t } = useTranslation();
  const { id: missionId, milestone } = useLocalSearchParams<{ id: string; milestone: string }>();
  const [camPerm, requestCam] = useCameraPermissions();
  const [micPerm, requestMic] = useMicrophonePermissions();
  const [locPerm, requestLoc] = Location.useForegroundPermissions();
  const camera = useRef<CameraView>(null);
  const [mode, setMode] = useState<CameraMode>('picture');
  const [recording, setRecording] = useState(false);
  const [fix, setFix] = useState<Location.LocationObject | null>(null);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [proofs, setProofs] = useState<CapturedProof[]>([]);
  const [body, setBody] = useState('');
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Position rafraîchie en continu pendant la prise de vue
  useEffect(() => {
    if (!locPerm?.granted) return;
    let sub: Location.LocationSubscription | null = null;
    void (async () => {
      try { setFix(await currentFix()); } catch (e) { setGpsError(e instanceof ProofLocationError ? e.message : 'gps'); }
      sub = await Location.watchPositionAsync({ accuracy: Location.Accuracy.High, distanceInterval: 5 }, (l) => {
        if (!l.mocked) { setFix(l); setGpsError(null); }
      });
    })();
    return () => sub?.remove();
  }, [locPerm?.granted]);

  if (!camPerm || !locPerm) return <Screen><Body>{t('common.loading')}</Body></Screen>;
  if (!camPerm.granted || !locPerm.granted) {
    return (
      <Screen>
        <Stack.Screen options={{ title: t('report.title') }} />
        <Banner tone="warning" icon="camera">{!camPerm.granted ? t('report.permissionCamera') : t('report.permissionLocation')}</Banner>
        <Button title={t('report.grant')} onPress={async () => { await requestCam(); await requestLoc(); }} />
      </Screen>
    );
  }

  const stamp = (uri: string, kind: CapturedProof['kind'], mimeType: string): CapturedProof | null => {
    if (!fix) { setGpsError('gps'); return null; }
    return { uri, kind, mimeType, capturedAt: new Date().toISOString(),
      latitude: fix.coords.latitude, longitude: fix.coords.longitude, accuracy: fix.coords.accuracy ?? null };
  };

  const takePhoto = async () => {
    const pic = await camera.current?.takePictureAsync({ quality: 0.6, exif: false });
    if (!pic) return;
    const p = stamp(pic.uri, 'photo', 'image/jpeg');
    if (p) setProofs((xs) => [...xs, p]);
  };

  const toggleVideo = async () => {
    if (recording) { camera.current?.stopRecording(); return; }
    if (!micPerm?.granted) { const r = await requestMic(); if (!r.granted) return; }
    setRecording(true);
    const startFix = fix;
    try {
      const vid = await camera.current?.recordAsync({ maxDuration: 60 });
      if (vid && startFix) {
        setProofs((xs) => [...xs, { uri: vid.uri, kind: 'video', mimeType: 'video/mp4', capturedAt: new Date().toISOString(),
          latitude: startFix.coords.latitude, longitude: startFix.coords.longitude, accuracy: startFix.coords.accuracy ?? null }]);
      }
    } finally { setRecording(false); }
  };

  const submit = async () => {
    if (proofs.length === 0) { setError(t('report.needMedia')); return; }
    setError(null); setProgress({ done: 0, total: proofs.length });
    try {
      const media = [];
      for (const [i, p] of proofs.entries()) {
        const path = await uploadFile('reports', `${missionId}/${milestone}`, p.uri, p.mimeType);
        media.push(toMediaPayload(p, path));
        setProgress({ done: i + 1, total: proofs.length });
      }
      const { error: e } = await supabase.rpc('submit_report', { p_milestone: milestone, p_body: body.trim(), p_media: media });
      if (e) throw e;
      router.back();
    } catch (e) {
      setError(t(`errors.${errorKey(e)}` as never, { defaultValue: t('errors.unknown') }));
    } finally { setProgress(null); }
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: t('report.title') }} />
      <Banner tone="primary" icon="shield-checkmark">{t('report.cameraOnly')}</Banner>
      <View style={styles.cameraWrap}>
        <CameraView ref={camera} style={StyleSheet.absoluteFill} mode={mode} facing="back" videoQuality="720p" />
        <View style={styles.gps}>
          <Ionicons name="location" size={14} color="#fff" />
          <Text style={styles.gpsText}>
            {fix ? t('report.gpsOk', { accuracy: Math.round(fix.coords.accuracy ?? 0) }) : gpsError ? t('report.gpsMissing') : t('report.gpsPending')}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button" accessibilityLabel={mode === 'picture' ? t('report.photo') : recording ? t('report.stop') : t('report.record')}
          onPress={() => void (mode === 'picture' ? takePhoto() : toggleVideo())} disabled={!fix}
          style={[styles.shutter, !fix && { opacity: 0.4 }, mode === 'video' && { backgroundColor: recording ? colors.danger : '#fff' }]}>
          {mode === 'video' && recording ? <View style={styles.stopSquare} /> : null}
        </Pressable>
      </View>
      <Row>
        <Chip label={t('report.photo')} selected={mode === 'picture'} onPress={() => !recording && setMode('picture')} />
        <Chip label={t('report.video')} selected={mode === 'video'} onPress={() => !recording && setMode('video')} />
      </Row>
      <H2>{t('report.media', { count: proofs.length })}</H2>
      <Row>
        {proofs.map((p, i) => (
          <Pressable key={p.uri} accessibilityLabel={t('common.delete')} onPress={() => setProofs((xs) => xs.filter((_, j) => j !== i))}>
            {p.kind === 'photo'
              ? <Image source={{ uri: p.uri }} style={styles.thumb} />
              : <View style={[styles.thumb, styles.videoThumb]}><Ionicons name="videocam" size={28} color={colors.primary} /></View>}
          </Pressable>
        ))}
      </Row>
      <Field label={t('report.body')} value={body} onChangeText={setBody} multiline placeholder={t('report.bodyPlaceholder')} maxLength={10000} />
      {error ? <Banner tone="danger">{error}</Banner> : null}
      <Button title={progress ? t('report.uploading', progress) : t('report.submit')} onPress={submit}
        loading={!!progress} disabled={proofs.length === 0 || body.trim().length === 0 || recording} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  cameraWrap: { height: 380, borderRadius: radius.lg, overflow: 'hidden', backgroundColor: '#000', justifyContent: 'flex-end', alignItems: 'center' },
  gps: { position: 'absolute', top: space.sm, start: space.sm, flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(0,0,0,0.55)', paddingHorizontal: space.sm, paddingVertical: 4, borderRadius: radius.pill },
  gpsText: { color: '#fff', fontSize: 12 },
  shutter: { width: 72, height: 72, borderRadius: 36, backgroundColor: '#fff', borderWidth: 4, borderColor: 'rgba(255,255,255,0.5)',
    marginBottom: space.lg, alignItems: 'center', justifyContent: 'center' },
  stopSquare: { width: 24, height: 24, backgroundColor: '#fff', borderRadius: 4 },
  thumb: { width: 80, height: 80, borderRadius: radius.sm },
  videoThumb: { backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
});
