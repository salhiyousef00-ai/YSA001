import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Body, Button, Row, Screen } from '@/components/ui';
import { LanguagePicker } from '@/components/LanguagePicker';
import { colors, font, radius, space } from '@/theme';
import type { IconName } from '@/components/ui';

export default function Welcome() {
  const { t } = useTranslation();
  const items: { icon: IconName; text: string }[] = [
    { icon: 'shield-checkmark', text: t('auth.trustVerified') },
    { icon: 'camera', text: t('auth.trustProofs') },
    { icon: 'lock-closed', text: t('auth.trustEscrow') },
  ];
  return (
    <Screen edges={['top', 'bottom', 'left', 'right']}>
      <View style={styles.logo}><Text style={styles.logoText}>W</Text></View>
      <Text accessibilityRole="header" style={[font.title, { color: colors.text, fontSize: 30 }]}>{t('auth.welcomeTitle')}</Text>
      <Body muted>{t('auth.welcomeSubtitle')}</Body>
      <View style={{ gap: space.md, marginVertical: space.md }}>
        {items.map((i) => (
          <Row key={i.icon} gap={space.md} style={{ flexWrap: 'nowrap' }}>
            <View style={styles.icon}><Ionicons name={i.icon} size={20} color={colors.primary} /></View>
            <Body style={{ flex: 1 }}>{i.text}</Body>
          </Row>
        ))}
      </View>
      <Button title={t('auth.getStarted')} icon="arrow-forward" onPress={() => router.push('/(auth)/sign-in')} />
      <LanguagePicker />
    </Screen>
  );
}

const styles = StyleSheet.create({
  logo: { width: 64, height: 64, borderRadius: radius.lg, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', marginTop: space.xl },
  logoText: { color: colors.onPrimary, fontSize: 34, fontWeight: '800' },
  icon: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
});
