import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { UserRole } from '@wasla/shared';
import { Banner, Body, Button, Card, H2, Screen, Title, type IconName } from '@/components/ui';
import { errorKey, supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/AuthProvider';
import { colors, space } from '@/theme';

export default function RoleScreen() {
  const { t } = useTranslation();
  const { refresh, signOut } = useAuth();
  const [role, setRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const options: { role: UserRole; icon: IconName; title: string; desc: string }[] = [
    { role: 'client', icon: 'airplane', title: t('auth.roleClient'), desc: t('auth.roleClientDesc') },
    { role: 'provider', icon: 'construct', title: t('auth.roleProvider'), desc: t('auth.roleProviderDesc') },
  ];

  const submit = async () => {
    if (!role) return;
    setLoading(true); setError(null);
    const { error: e } = await supabase.rpc('set_my_role', { p_role: role });
    setLoading(false);
    if (e) { setError(t(`errors.${errorKey(e)}` as never, { defaultValue: t('errors.unknown') })); return; }
    await refresh();
  };

  return (
    <Screen>
      <Title>{t('auth.roleTitle')}</Title>
      {options.map((o) => {
        const selected = role === o.role;
        return (
          <Card key={o.role} onPress={() => setRole(o.role)} accessibilityLabel={o.title}
            style={selected ? { borderColor: colors.primary, borderWidth: 2 } : undefined}>
            <View style={{ flexDirection: 'row', gap: space.md, alignItems: 'center' }}>
              <Ionicons name={o.icon} size={28} color={colors.primary} />
              <View style={{ flex: 1, gap: 2 }}>
                <H2>{o.title}</H2>
                <Body muted small>{o.desc}</Body>
              </View>
              <Ionicons name={selected ? 'radio-button-on' : 'radio-button-off'} size={22} color={colors.primary} />
            </View>
          </Card>
        );
      })}
      {error ? <Banner tone="danger">{error}</Banner> : null}
      <Button title={t('common.continue')} onPress={submit} disabled={!role} loading={loading} />
      <Button variant="ghost" title={t('auth.signOut')} onPress={signOut} />
    </Screen>
  );
}
