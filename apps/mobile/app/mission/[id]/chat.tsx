import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import type { Message } from '@wasla/shared';
import { Empty } from '@/components/ui';
import { signedUrls, uploadFile } from '@/lib/storage';
import { supabase } from '@/lib/supabase';
import { useMe } from '@/providers/AuthProvider';
import { colors, font, minTouch, radius, space } from '@/theme';

export default function Chat() {
  const { t } = useTranslation();
  const { id: missionId } = useLocalSearchParams<{ id: string }>();
  const { uid } = useMe();
  const [messages, setMessages] = useState<Message[]>([]);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const list = useRef<FlatList<Message>>(null);

  const resolveImages = useCallback(async (msgs: Message[]) => {
    const paths = msgs.map((m) => m.image_path).filter((p): p is string => !!p);
    if (paths.length) { const u = await signedUrls('chat', paths, 3600); setUrls((x) => ({ ...x, ...u })); }
  }, []);

  useEffect(() => {
    void (async () => {
      const { data } = await supabase.from('messages').select('*').eq('mission_id', missionId).order('created_at').limit(500);
      const msgs = (data ?? []) as Message[];
      setMessages(msgs);
      void resolveImages(msgs);
    })();
    // Supabase Realtime : la RLS s'applique aussi aux événements reçus
    const ch = supabase.channel(`chat-${missionId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `mission_id=eq.${missionId}` }, (payload) => {
        const m = payload.new as Message;
        setMessages((xs) => (xs.some((x) => x.id === m.id) ? xs : [...xs, m]));
        void resolveImages([m]);
      })
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [missionId, resolveImages]);

  const send = async (body: string | null, imagePath: string | null) => {
    setSending(true);
    const { data, error } = await supabase.from('messages')
      .insert({ mission_id: missionId, sender_id: uid, body, image_path: imagePath }).select().single();
    setSending(false);
    if (!error && data) {
      setMessages((xs) => (xs.some((x) => x.id === (data as Message).id) ? xs : [...xs, data as Message]));
      if (imagePath) void resolveImages([data as Message]);
    }
    return !error;
  };

  const sendText = async () => {
    const body = text.trim();
    if (!body) return;
    if (await send(body, null)) setText('');
  };

  const sendImage = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.6 });
    const a = res.canceled ? null : res.assets[0];
    if (!a) return;
    setSending(true);
    try {
      const path = await uploadFile('chat', missionId, a.uri, a.mimeType ?? 'image/jpeg');
      await send(null, path);
    } finally { setSending(false); }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['bottom']}>
      <Stack.Screen options={{ title: t('mission.chat') }} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
        <FlatList
          ref={list} data={messages} keyExtractor={(m) => m.id}
          contentContainerStyle={{ padding: space.lg, gap: space.sm, flexGrow: 1 }}
          onContentSizeChange={() => list.current?.scrollToEnd({ animated: true })}
          ListEmptyComponent={<Empty icon="chatbubbles-outline" text={t('chat.empty')} />}
          renderItem={({ item: m }) => {
            const mine = m.sender_id === uid;
            return (
              <View style={[styles.bubble, mine ? styles.mine : styles.theirs]}>
                {m.image_path && urls[m.image_path] ? (
                  <Image source={{ uri: urls[m.image_path] }} style={styles.image} accessibilityLabel={t('chat.photo')} />
                ) : null}
                {m.body ? <Text style={[font.body, { color: mine ? colors.onPrimary : colors.text }]}>{m.body}</Text> : null}
                <Text style={[font.caption, { color: mine ? 'rgba(255,255,255,0.75)' : colors.textMuted, alignSelf: 'flex-end' }]}>
                  {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </View>
            );
          }}
        />
        <View style={styles.composer}>
          <Pressable accessibilityRole="button" accessibilityLabel={t('chat.photo')} onPress={sendImage} disabled={sending} style={styles.iconBtn}>
            <Ionicons name="image-outline" size={24} color={colors.primary} />
          </Pressable>
          <TextInput value={text} onChangeText={setText} placeholder={t('chat.placeholder')} placeholderTextColor={colors.textMuted}
            accessibilityLabel={t('chat.placeholder')} style={styles.input} multiline maxLength={4000} />
          <Pressable accessibilityRole="button" accessibilityLabel={t('common.send')} onPress={sendText} disabled={sending || !text.trim()}
            style={[styles.iconBtn, styles.sendBtn, (!text.trim() || sending) && { opacity: 0.5 }]}>
            <Ionicons name="send" size={20} color={colors.onPrimary} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  bubble: { maxWidth: '80%', padding: space.md, borderRadius: radius.lg, gap: 4 },
  mine: { alignSelf: 'flex-end', backgroundColor: colors.primary, borderBottomEndRadius: 4 },
  theirs: { alignSelf: 'flex-start', backgroundColor: colors.surface, borderBottomStartRadius: 4, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  image: { width: 220, height: 220, borderRadius: radius.md },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: space.sm, padding: space.sm, backgroundColor: colors.surface, borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  input: { flex: 1, minHeight: minTouch - 4, maxHeight: 120, borderRadius: radius.lg, backgroundColor: colors.surfaceAlt, paddingHorizontal: space.md, paddingVertical: space.sm, fontSize: 16, color: colors.text, textAlign: 'auto' },
  iconBtn: { width: minTouch, height: minTouch, alignItems: 'center', justifyContent: 'center', borderRadius: minTouch / 2 },
  sendBtn: { backgroundColor: colors.primary },
});
