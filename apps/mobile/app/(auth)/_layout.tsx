import { Stack } from 'expo-router';
import { colors } from '@/theme';

export default function AuthLayout() {
  return <Stack screenOptions={{ headerShown: true, title: '', headerShadowVisible: false, headerTintColor: colors.primary,
    headerStyle: { backgroundColor: colors.bg }, contentStyle: { backgroundColor: colors.bg } }}>
    <Stack.Screen name="welcome" options={{ headerShown: false }} />
  </Stack>;
}
