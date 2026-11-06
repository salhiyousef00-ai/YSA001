import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { supabase } from './supabase';
import { useAuth } from '@/providers/AuthProvider';
import { colors } from '@/theme';

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
});

/** Enregistre le jeton Expo Push de l'appareil pour l'utilisateur connecté. */
export async function registerForPush(userId: string): Promise<string | null> {
  if (!Device.isDevice) return null; // pas de push sur simulateur
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', { name: 'Wasla', importance: Notifications.AndroidImportance.DEFAULT, lightColor: colors.primary });
  }
  let { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') status = (await Notifications.requestPermissionsAsync()).status;
  if (status !== 'granted') return null;
  const projectId = (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId ?? Constants.easConfig?.projectId;
  const { data: token } = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
  await supabase.from('push_tokens').upsert({ token, user_id: userId, platform: Platform.OS === 'ios' ? 'ios' : 'android' });
  return token;
}

/** Route cible d'une notification (payload construit côté base, voir private.notify). */
export function routeForNotification(type: string, data: Record<string, unknown>): string | null {
  const mission = typeof data.mission_id === 'string' ? data.mission_id : null;
  const request = typeof data.request_id === 'string' ? data.request_id : null;
  switch (type) {
    case 'new_message': return mission ? `/mission/${mission}/chat` : null;
    case 'new_quote': return request ? `/request/${request}` : null;
    case 'verification_update': return '/verification';
    default: return mission ? `/mission/${mission}` : null;
  }
}

/** Monté dans le layout racine : enregistrement du jeton + navigation au tap. */
export function NotificationsBridge() {
  const { session } = useAuth();
  const uid = session?.user.id;

  useEffect(() => {
    if (uid) void registerForPush(uid).catch(() => undefined);
  }, [uid]);

  useEffect(() => {
    const open = (n: Notifications.Notification) => {
      const data = (n.request.content.data ?? {}) as Record<string, unknown>;
      const route = routeForNotification(String(data.type ?? ''), data);
      if (route) router.push(route as never);
    };
    const last = Notifications.getLastNotificationResponse();
    if (last) open(last.notification);
    const sub = Notifications.addNotificationResponseReceivedListener((r) => open(r.notification));
    return () => sub.remove();
  }, []);

  return null;
}
