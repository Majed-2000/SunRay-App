import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { colors, radius, shadows, spacing } from '@/theme';
import { useCartStore } from '@/store';
import { useCartTotals } from '@/hooks/useCartTotals';
import { toArabicDigits, formatRiyal } from '@/utils/numerals';
import { Txt } from './Txt';

/** Floating "view cart" bar shown above the tab bar when the cart has items. */
export function FloatingCartBar({ bottom = 70 }: { bottom?: number }) {
  const count = useCartStore((s) => s.lines.reduce((a, l) => a + l.qty, 0));
  const { total } = useCartTotals();
  if (count === 0) return null;

  return (
    <Pressable
      onPress={() => router.push('/cart')}
      style={[
        shadows.lg,
        {
          position: 'absolute',
          left: spacing.lg,
          right: spacing.lg,
          bottom,
          backgroundColor: colors.ink,
          borderRadius: radius.lg,
          paddingVertical: 15,
          paddingHorizontal: 18,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        },
      ]}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <View
          style={{
            backgroundColor: colors.gold,
            width: 26,
            height: 26,
            borderRadius: radius.full,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Txt size={13} weight="black" color={colors.inkDeep}>
            {toArabicDigits(count)}
          </Txt>
        </View>
        <Txt size={15} weight="extraBold" color={colors.white}>
          عرض السلة
        </Txt>
      </View>
      <Txt size={15} weight="black" color={colors.goldText}>
        {formatRiyal(total)}
      </Txt>
    </Pressable>
  );
}
