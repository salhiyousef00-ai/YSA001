import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { initI18n } from '@/i18n';
import { AuthProvider, useAuth } from '@/providers/AuthProvider';
import { RefDataProvider } from '@/providers/RefDataProvider';
import { NotificationsBridge } from '@/lib/notifications';
import { Loading } from '@/components/ui';
import { colors } from '@/theme';

function Gate() {
  const { session, profile, initializing } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const { t } = useTranslation();

  useEffect(() => {
    if (initializing) return;
    const group = segments[0];
    const inAuth = group === '(auth)';
    const inOnboarding = group === 'onboarding';
    if (!session) {
      if (!inAuth) router.replace('/(auth)/welcome');
    } else if (!profile) {
      // profil en cours de chargement
    } else if (!profile.role) {
      if (segments.join('/') !== 'onboarding/role') router.replace('/onboarding/role');
    } else if (!profile.onboarded && profile.role !== 'admin') {
      const target = profile.role === 'provider' ? 'onboarding/provider' : 'onboarding/client';
      if (segments.join('/') !== target) router.replace(`/${target}` as never);
    } else if (inAuth || inOnboarding) {
      router.replace('/(tabs)');
    }
  }, [session, profile, initializing, segments, router]);

  if (initializing) return <Loading />;

  return (
    <>
      <NotificationsBridge />
      <Stack screenOptions={{
        headerTintColor: colors.primary, headerStyle: { backgroundColor: colors.surface },
        headerTitleStyle: { color: colors.text }, contentStyle: { backgroundColor: colors.bg }, headerBackTitle: t('common.back'),
      }}>
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="onboarding/role" options={{ title: '', headerBackVisible: false }} />
        <Stack.Screen name="onboarding/client" options={{ title: t('onboarding.clientTitle'), headerBackVisible: false }} />
        <Stack.Screen name="onboarding/provider" options={{ title: t('onboarding.providerTitle'), headerBackVisible: false }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  const [ready, setReady] = useState(false);
  useEffect(() => { initI18n().finally(() => setReady(true)); }, []);
  if (!ready) return <Loading />;
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <AuthProvider>
        <RefDataProvider>
          <Gate />
        </RefDataProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
