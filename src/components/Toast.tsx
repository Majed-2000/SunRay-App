import { useEffect, useRef } from 'react';
import { Animated, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useUiStore } from '@/store';
import { colors, radius, shadows } from '@/theme';
import { Txt } from './Txt';

/** Global toast, mounted once at the root. Driven by uiStore. */
export function Toast() {
  const message = useUiStore((s) => s.toast);
  const insets = useSafeAreaInsets();
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(anim, {
      toValue: message ? 1 : 0,
      useNativeDriver: true,
      bounciness: message ? 8 : 0,
      speed: 16,
    }).start();
  }, [message, anim]);

  if (!message) return null;

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.wrap,
        {
          bottom: insets.bottom + 96,
          opacity: anim,
          transform: [
            {
              translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }),
            },
          ],
        },
      ]}
    >
      <Txt size={14} weight="bold" color={colors.white} style={styles.text}>
        {message}
      </Txt>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    alignSelf: 'center',
    backgroundColor: colors.ink,
    borderRadius: radius.pill,
    paddingVertical: 13,
    paddingHorizontal: 24,
    ...shadows.lg,
  },
  text: { textAlign: 'center' },
});
