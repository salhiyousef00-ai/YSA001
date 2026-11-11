import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/providers/AuthProvider';
import { colors } from '@/theme';
import type { IconName } from '@/components/ui';

const icon = (name: IconName) => ({ color, size }: { color: string | import("react-native").ColorValue; size: number }) => <Ionicons name={name} size={size} color={color as string} />;

export default function TabsLayout() {
  const { t } = useTranslation();
  const { profile } = useAuth();
  const isProvider = profile?.role === 'provider';
  return (
    <Tabs screenOptions={{
      tabBarActiveTintColor: colors.primary, tabBarInactiveTintColor: colors.textMuted,
      headerTintColor: colors.text, headerStyle: { backgroundColor: colors.surface },
      tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border }, tabBarLabelStyle: { fontSize: 12 },
    }}>
      <Tabs.Screen name="index" options={{ title: t('tabs.home'), tabBarIcon: icon('home-outline') }} />
      <Tabs.Screen name="requests" options={{ title: t('tabs.requests'), tabBarIcon: icon('document-text-outline'), href: isProvider ? null : undefined }} />
      <Tabs.Screen name="jobs" options={{ title: t('tabs.jobs'), tabBarIcon: icon('briefcase-outline'), href: isProvider ? undefined : null }} />
      <Tabs.Screen name="wallet" options={{ title: t('tabs.wallet'), tabBarIcon: icon('wallet-outline') }} />
      <Tabs.Screen name="profile" options={{ title: t('tabs.profile'), tabBarIcon: icon('person-circle-outline') }} />
    </Tabs>
  );
}
