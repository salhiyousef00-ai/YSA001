import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps, ReactNode } from 'react';
import {
  ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View,
  type TextInputProps, type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { formatMAD } from '@wasla/shared';
import { colors, font, minTouch, radius, space, toneColors, type Tone } from '@/theme';
import { currentLocale } from '@/i18n';

export type IconName = ComponentProps<typeof Ionicons>['name'];

export function Screen({ children, scroll = true, refreshing, onRefresh, padded = true, edges }: {
  children: ReactNode; scroll?: boolean; refreshing?: boolean; onRefresh?: () => void; padded?: boolean;
  edges?: ('top' | 'bottom' | 'left' | 'right')[];
}) {
  const content = <View style={[padded && styles.padded, { gap: space.lg }]}>{children}</View>;
  return (
    <SafeAreaView style={styles.screen} edges={edges ?? ['left', 'right', 'bottom']}>
      {scroll ? (
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: space.xxl }}
          refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={colors.primary} /> : undefined}
        >{content}</ScrollView>
      ) : <View style={[{ flex: 1 }, padded && styles.padded]}>{children}</View>}
    </SafeAreaView>
  );
}

export function Title({ children, sub }: { children: ReactNode; sub?: ReactNode }) {
  return (
    <View style={{ gap: space.xs }}>
      <Text accessibilityRole="header" style={[font.title, { color: colors.text }]}>{children}</Text>
      {sub ? <Text style={[font.body, { color: colors.textMuted }]}>{sub}</Text> : null}
    </View>
  );
}

export function H2({ children }: { children: ReactNode }) {
  return <Text accessibilityRole="header" style={[font.h2, { color: colors.text }]}>{children}</Text>;
}

export function Body({ children, muted, small, style }: { children: ReactNode; muted?: boolean; small?: boolean; style?: object }) {
  return <Text style={[small ? font.small : font.body, { color: muted ? colors.textMuted : colors.text }, style]}>{children}</Text>;
}

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export function Button({ title, onPress, variant = 'primary', loading, disabled, icon, accessibilityHint, style }: {
  title: string; onPress?: () => void; variant?: ButtonVariant; loading?: boolean; disabled?: boolean;
  icon?: IconName; accessibilityHint?: string; style?: ViewStyle;
}) {
  const v = buttonVariants[variant];
  const isDisabled = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button" accessibilityLabel={title} accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: !!isDisabled, busy: !!loading }}
      onPress={onPress} disabled={isDisabled}
      style={({ pressed }) => [styles.button, { backgroundColor: pressed ? v.pressed : v.bg, borderColor: v.border },
        isDisabled && { opacity: 0.5 }, style]}
    >
      {loading ? <ActivityIndicator color={v.fg} /> : (
        <>
          {icon ? <Ionicons name={icon} size={20} color={v.fg} /> : null}
          <Text style={[font.h3, { color: v.fg }]}>{title}</Text>
        </>
      )}
    </Pressable>
  );
}
const buttonVariants: Record<ButtonVariant, { bg: string; pressed: string; fg: string; border: string }> = {
  primary: { bg: colors.primary, pressed: colors.primaryPressed, fg: colors.onPrimary, border: colors.primary },
  secondary: { bg: colors.surface, pressed: colors.surfaceAlt, fg: colors.primary, border: colors.border },
  ghost: { bg: 'transparent', pressed: colors.surfaceAlt, fg: colors.primary, border: 'transparent' },
  danger: { bg: colors.surface, pressed: colors.dangerSoft, fg: colors.danger, border: colors.danger },
};

export function Card({ children, onPress, style, accessibilityLabel }: {
  children: ReactNode; onPress?: () => void; style?: ViewStyle; accessibilityLabel?: string;
}) {
  if (!onPress) return <View style={[styles.card, style]}>{children}</View>;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel} onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && { backgroundColor: colors.surfaceAlt }, style]}>
      {children}
    </Pressable>
  );
}

export function Field({ label, hint, error, ...props }: TextInputProps & { label: string; hint?: string; error?: string | null }) {
  return (
    <View style={{ gap: space.xs }}>
      <Text style={[font.small, { color: colors.text, fontWeight: '600' }]}>{label}</Text>
      <TextInput
        accessibilityLabel={label} accessibilityHint={hint}
        placeholderTextColor={colors.textMuted}
        style={[styles.input, props.multiline && { minHeight: 110, textAlignVertical: 'top' }, error ? { borderColor: colors.danger } : null]}
        {...props}
      />
      {error ? <Text accessibilityLiveRegion="polite" style={[font.caption, { color: colors.danger }]}>{error}</Text>
        : hint ? <Text style={[font.caption, { color: colors.textMuted }]}>{hint}</Text> : null}
    </View>
  );
}

export function Pill({ label, tone = 'neutral', icon }: { label: string; tone?: Tone; icon?: IconName }) {
  const c = toneColors[tone];
  return (
    <View style={[styles.pill, { backgroundColor: c.bg }]}>
      {icon ? <Ionicons name={icon} size={14} color={c.fg} /> : null}
      <Text style={[font.caption, { color: c.fg, fontWeight: '600' }]}>{label}</Text>
    </View>
  );
}

export function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: selected }} accessibilityLabel={label} onPress={onPress}
      style={[styles.chip, selected && { backgroundColor: colors.primary, borderColor: colors.primary }]}>
      {selected ? <Ionicons name="checkmark" size={16} color={colors.onPrimary} /> : null}
      <Text style={[font.small, { color: selected ? colors.onPrimary : colors.text }]}>{label}</Text>
    </Pressable>
  );
}

export function Row({ children, style, gap = space.sm }: { children: ReactNode; style?: ViewStyle; gap?: number }) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center', gap, flexWrap: 'wrap' }, style]}>{children}</View>;
}

export function Banner({ tone = 'info', icon = 'information-circle', children, action }: {
  tone?: Tone; icon?: IconName; children: ReactNode; action?: ReactNode;
}) {
  const c = toneColors[tone];
  return (
    <View accessibilityRole="alert" style={[styles.banner, { backgroundColor: c.bg }]}>
      <Ionicons name={icon} size={22} color={c.fg} />
      <View style={{ flex: 1, gap: space.sm }}>
        <Text style={[font.small, { color: c.fg }]}>{children}</Text>
        {action}
      </View>
    </View>
  );
}

export function Empty({ icon = 'leaf-outline', text }: { icon?: IconName; text: string }) {
  return (
    <View style={{ alignItems: 'center', padding: space.xl, gap: space.md }}>
      <Ionicons name={icon} size={40} color={colors.textMuted} />
      <Text style={[font.body, { color: colors.textMuted, textAlign: 'center' }]}>{text}</Text>
    </View>
  );
}

export function Loading() {
  const { t } = useTranslation();
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.xl, backgroundColor: colors.bg }}>
      <ActivityIndicator size="large" color={colors.primary} accessibilityLabel={t('common.loading')} />
    </View>
  );
}

export function ErrorState({ onRetry }: { onRetry?: () => void }) {
  const { t } = useTranslation();
  return (
    <View style={{ alignItems: 'center', padding: space.xl, gap: space.md }}>
      <Ionicons name="cloud-offline-outline" size={40} color={colors.danger} />
      <Body muted>{t('common.error')}</Body>
      {onRetry ? <Button variant="secondary" title={t('common.retry')} onPress={onRetry} /> : null}
    </View>
  );
}

export function Money({ cents, size = 'body', muted }: { cents: number; size?: 'body' | 'amount' | 'h3'; muted?: boolean }) {
  const locale = currentLocale() === 'ar' ? 'ar-MA' : currentLocale() === 'en' ? 'en-MA' : 'fr-MA';
  return (
    <Text style={[size === 'amount' ? font.amount : size === 'h3' ? font.h3 : font.body,
      { color: muted ? colors.textMuted : colors.text, fontVariant: ['tabular-nums'] }]}>
      {formatMAD(cents, locale)}
    </Text>
  );
}

export function Divider() {
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.border }} />;
}

export function ListItem({ icon, title, subtitle, right, onPress }: {
  icon?: IconName; title: string; subtitle?: string; right?: ReactNode; onPress?: () => void;
}) {
  return (
    <Pressable accessibilityRole={onPress ? 'button' : undefined} onPress={onPress} disabled={!onPress}
      style={({ pressed }) => [styles.listItem, pressed && { backgroundColor: colors.surfaceAlt }]}>
      {icon ? <View style={styles.iconWrap}><Ionicons name={icon} size={20} color={colors.primary} /></View> : null}
      <View style={{ flex: 1 }}>
        <Text style={[font.body, { color: colors.text }]}>{title}</Text>
        {subtitle ? <Text style={[font.small, { color: colors.textMuted }]}>{subtitle}</Text> : null}
      </View>
      {right ?? (onPress ? <Ionicons name="chevron-forward" size={18} color={colors.textMuted} style={{ transform: [{ scaleX: 1 }] }} /> : null)}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  padded: { padding: space.lg },
  button: {
    minHeight: minTouch, borderRadius: radius.md, paddingHorizontal: space.lg, borderWidth: 1,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm,
  },
  card: {
    backgroundColor: colors.surface, borderRadius: radius.lg, padding: space.lg, gap: space.sm,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
  },
  input: {
    minHeight: minTouch, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
    paddingHorizontal: space.md, paddingVertical: space.sm, backgroundColor: colors.surface,
    fontSize: 16, color: colors.text, textAlign: 'auto',
  },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: space.sm, paddingVertical: 3, borderRadius: radius.pill, alignSelf: 'flex-start' },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 40, paddingHorizontal: space.md,
    borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface,
  },
  banner: { flexDirection: 'row', gap: space.md, padding: space.md, borderRadius: radius.md, alignItems: 'flex-start' },
  listItem: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 56, paddingVertical: space.sm, paddingHorizontal: space.xs, borderRadius: radius.sm },
  iconWrap: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
});
