import { useEffect, useRef } from 'react';
import { Animated, Easing, View, type ViewStyle } from 'react-native';
import { colors, radius, shadows } from '@/theme';
import { PRODUCT_ROW_HEIGHT } from './ProductCard';

/**
 * Placeholder shaped like the content it is standing in for.
 *
 * The menu showed a centred gold spinner on an otherwise empty screen while it
 * pulled 111 products from Foodics. A spinner communicates "something is
 * happening"; it does not communicate what, or how much, or that the wait is
 * nearly over — so a slow connection reads as a broken screen. Rows in the
 * right shape and count set the expectation before the data lands, and the
 * swap into real content is a fill rather than a jump, because the layout is
 * already the size it will end up.
 */

/** One pulsing block. Opacity only — it is the one property that animates off
 *  the JS thread without triggering layout. */
function Pulse({ style }: { style?: ViewStyle }) {
  const opacity = useRef(new Animated.Value(0.45)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 700,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.45,
          duration: 700,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[{ backgroundColor: colors.shimmerFrom, borderRadius: radius.sm, opacity }, style]}
    />
  );
}

/** A stand-in for one ProductRow, matched to its real height so nothing shifts. */
export function ProductRowSkeleton() {
  return (
    <View
      style={[
        shadows.sm,
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 13,
          backgroundColor: colors.card,
          borderRadius: radius.lg,
          padding: 12,
          height: PRODUCT_ROW_HEIGHT,
        },
      ]}
    >
      <Pulse style={{ width: 66, height: 66, borderRadius: radius.md }} />
      <View style={{ flex: 1, gap: 8 }}>
        <Pulse style={{ width: '62%', height: 14 }} />
        <Pulse style={{ width: '38%', height: 10 }} />
        <Pulse style={{ width: '26%', height: 12 }} />
      </View>
      <Pulse style={{ width: 30, height: 30, borderRadius: radius.full }} />
    </View>
  );
}

export interface MenuSkeletonProps {
  /** How many rows to draw. Defaults to roughly one phone screen. */
  rows?: number;
}

/** The menu list, mid-load. */
export function MenuSkeleton({ rows = 7 }: MenuSkeletonProps) {
  return (
    <View style={{ gap: 12, paddingTop: 4 }} accessibilityLabel="جارٍ تحميل القائمة">
      {Array.from({ length: rows }).map((_, i) => (
        <ProductRowSkeleton key={i} />
      ))}
    </View>
  );
}
