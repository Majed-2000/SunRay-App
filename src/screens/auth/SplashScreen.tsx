import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { colors, gradients } from '@/theme';
import { Txt } from '@/components';
import { useAuthStore } from '@/store';

export function SplashScreen() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const hasOnboarded = useAuthStore((s) => s.hasOnboarded);
  const isHydrating = useAuthStore((s) => s.isHydrating);
  const scale = useRef(new Animated.Value(0.8)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const glow = useRef(new Animated.Value(0)).current;
  const [minElapsed, setMinElapsed] = useState(false);

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, friction: 6 }),
      Animated.timing(opacity, { toValue: 1, duration: 600, useNativeDriver: true }),
    ]).start();
    Animated.loop(
      Animated.sequence([
        Animated.timing(glow, { toValue: 1, duration: 2200, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(glow, { toValue: 0, duration: 2200, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    ).start();

    const timer = setTimeout(() => setMinElapsed(true), 1700);
    return () => clearTimeout(timer);
  }, [glow, opacity, scale]);

  // Route only after the minimum splash time AND once session restore finishes
  // (so we don't flash login before a saved backend session is restored).
  useEffect(() => {
    if (!minElapsed || isHydrating) return;
    if (isAuthenticated) router.replace('/(tabs)/home');
    else if (hasOnboarded) router.replace('/(auth)/login');
    else router.replace('/(auth)/onboarding');
  }, [minElapsed, isHydrating, isAuthenticated, hasOnboarded]);

  return (
    <LinearGradient colors={gradients.screen} style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View
        style={{
          position: 'absolute',
          width: 300,
          height: 300,
          borderRadius: 150,
          backgroundColor: colors.gold,
          opacity: glow.interpolate({ inputRange: [0, 1], outputRange: [0.12, 0.28] }),
          transform: [{ scale: glow.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1.1] }) }],
        }}
      />
      {/*
        The wordmark, alone, in Biome W01 Black.

        This screen used to break two rules the identity states outright. It set
        "Sun Ray" as live text in Plus Jakarta — and the guidelines forbid any
        typeface but Biome for the wordmark. And it stacked the sunflower symbol
        directly above that wordmark, which "never combine the wordmark with the
        sunflower symbol in same design" rules out. Both on the first screen a
        customer ever sees.

        The symbol keeps its own jobs — app icon, favicon, tight spaces — where
        it stands alone as the guidelines intend.

        The taglines take the wordmark's colour exactly, per "Match wordmark
        color exactly when paired with SUN RAY".
      */}
      <Animated.View style={{ opacity, transform: [{ scale }], alignItems: 'center' }}>
        <Txt wordmark size={46} color={colors.ink} tracking={1}>
          SUN RAY
        </Txt>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 18 }}>
          <View style={{ height: 1, width: 26, backgroundColor: colors.border }} />
          <Txt size={14} weight="medium" color={colors.ink}>
            دائمًا كن مشرقًا
          </Txt>
          <View style={{ height: 1, width: 26, backgroundColor: colors.border }} />
        </View>
        <Txt size={11} weight="bold" latin tracking={3} color={colors.ink} style={{ marginTop: 8 }}>
          ALWAYS BE RADIANT
        </Txt>
      </Animated.View>
    </LinearGradient>
  );
}
