import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, View } from 'react-native';
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
  const visible = count > 0;

  /**
   * Slide in, rather than appear.
   *
   * This bar used to return null at zero and a full black bar at one, so adding
   * the first item made it snap into existence with no relationship to the tap
   * that caused it. It is the most frequent state change in the app — every
   * "+" on the menu goes through it — and the abruptness read as a glitch
   * rather than as a response.
   *
   * The exit is faster than the entrance: arriving deserves to be noticed,
   * leaving should get out of the way. `mounted` lags `visible` so the bar
   * survives long enough to animate out instead of vanishing on the frame the
   * cart empties.
   *
   * Opacity and transform only — both run on the UI thread, so the animation
   * holds while JS is busy recalculating cart totals, which is exactly when it
   * fires.
   */
  const [mounted, setMounted] = useState(visible);
  const progress = useRef(new Animated.Value(visible ? 1 : 0)).current;

  useEffect(() => {
    if (visible) setMounted(true);
    const anim = Animated.timing(progress, {
      toValue: visible ? 1 : 0,
      duration: visible ? 260 : 160,
      easing: visible ? Easing.out(Easing.cubic) : Easing.in(Easing.quad),
      useNativeDriver: true,
    });
    anim.start(({ finished }) => {
      if (finished && !visible) setMounted(false);
    });
    return () => anim.stop();
  }, [visible, progress]);

  if (!mounted) return null;

  return (
    <Animated.View
      pointerEvents={visible ? 'auto' : 'none'}
      style={{
        position: 'absolute',
        left: spacing.lg,
        right: spacing.lg,
        bottom,
        opacity: progress,
        transform: [
          {
            translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }),
          },
        ],
      }}
    >
      <Pressable
        onPress={() => router.push('/cart')}
        accessibilityRole="button"
        accessibilityLabel={`عرض السلة، ${count} عنصر، الإجمالي ${formatRiyal(total)}`}
        style={({ pressed }) => [
          shadows.lg,
          {
            backgroundColor: colors.ink,
            borderRadius: radius.lg,
            paddingVertical: 15,
            paddingHorizontal: 18,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            transform: [{ scale: pressed ? 0.985 : 1 }],
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
    </Animated.View>
  );
}
