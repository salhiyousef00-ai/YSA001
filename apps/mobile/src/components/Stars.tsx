import { Ionicons } from '@expo/vector-icons';
import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors } from '@/theme';

export function Stars({ value, onChange, size = 18 }: { value: number; onChange?: (v: number) => void; size?: number }) {
  const { t } = useTranslation();
  return (
    <View accessible={!onChange} accessibilityLabel={t('review.stars', { count: Math.round(value) })} style={{ flexDirection: 'row', gap: 2 }}>
      {[1, 2, 3, 4, 5].map((i) => {
        const icon = value >= i ? 'star' : value >= i - 0.5 ? 'star-half' : 'star-outline';
        const star = <Ionicons name={icon} size={size} color={colors.gold} />;
        return onChange ? (
          <Pressable key={i} onPress={() => onChange(i)} accessibilityRole="button" accessibilityLabel={t('review.stars', { count: i })}
            accessibilityState={{ selected: value === i }} hitSlop={6} style={{ padding: 4 }}>{star}</Pressable>
        ) : <View key={i}>{star}</View>;
      })}
    </View>
  );
}
