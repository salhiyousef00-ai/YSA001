import { router } from 'expo-router';
import { useState } from 'react';
import { Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Banner, Body, Button, Card, Divider, H2, ListItem, Screen, Title } from '@/components/ui';
import { VerificationPill } from '@/components/status';
import { LanguagePicker } from '@/components/LanguagePicker';
import { errorKey, supabase } from '@/lib/supabase';
import { useMe } from '@/providers/AuthProvider';

export default function ProfileTab() {
  const { t } = useTranslation();
  const { uid, profile, providerProfile, signOut } = useMe();
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isProvider = profile.role === 'provider';

  const deleteAccount = () => {
    Alert.alert(t('profile.deleteAccount'), t('profile.deleteConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.delete'), style: 'destructive', onPress: async () => {
        setDeleting(true); setError(null);
        const { error: e } = await supabase.functions.invoke('delete-account', { method: 'POST' });
        setDeleting(false);
        if (e) {
          let code = 'unknown';
          try { code = (await (e as { context?: Response }).context?.json())?.error ?? errorKey(e); } catch { /* ignore */ }
          setError(t(`errors.${code}` as never, { defaultValue: t('errors.unknown') }));
          return;
        }
        Alert.alert(t('profile.deleted'));
        await signOut();
      } },
    ]);
  };

  return (
    <Screen>
      <Title sub={profile.phone ?? undefined}>{profile.full_name ?? '—'}</Title>
      {isProvider && providerProfile ? (
        <Card>
          <VerificationPill status={providerProfile.verification_status} />
          <ListItem icon="shield-checkmark-outline" title={t('profile.verification')} onPress={() => router.push('/verification')} />
          <Divider />
          <ListItem icon="person-outline" title={t('profile.publicProfile')} onPress={() => router.push(`/provider/${uid}`)} />
          <Divider />
          <ListItem icon="options-outline" title={t('profile.editServices')} onPress={() => router.push('/settings/services')} />
        </Card>
      ) : null}
      <Card>
        <H2>{t('profile.language')}</H2>
        <LanguagePicker persistForUser={uid} />
      </Card>
      <Body muted small>{t('profile.privacy')}</Body>
      {error ? <Banner tone="danger">{error}</Banner> : null}
      <Button variant="secondary" icon="log-out-outline" title={t('auth.signOut')} onPress={signOut} />
      <Button variant="danger" icon="trash-outline" title={t('profile.deleteAccount')} onPress={deleteAccount} loading={deleting} />
    </Screen>
  );
}
