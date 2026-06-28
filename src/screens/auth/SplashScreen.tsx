import { useEffect, useRef } from 'react';
import { Animated, Easing, Image, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { colors, gradients } from '@/theme';
import { LOGO } from '@/assets';
import { Txt } from '@/components';
import { useAuthStore } from '@/store';

export function SplashScreen() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const hasOnboarded = useAuthStore((s) => s.hasOnboarded);
  const scale = useRef(new Animated.Value(0.8)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const glow = useRef(new Animated.Value(0)).current;

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

    const timer = setTimeout(() => {
      if (isAuthenticated) router.replace('/(tabs)/home');
      else if (hasOnboarded) router.replace('/(auth)/login');
      else router.replace('/(auth)/onboarding');
    }, 1700);
    return () => clearTimeout(timer);
  }, [glow, opacity, scale, isAuthenticated, hasOnboarded]);

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
      <Animated.View style={{ opacity, transform: [{ scale }], alignItems: 'center' }}>
        <Image source={LOGO} style={{ width: 132, height: 132 }} resizeMode="contain" />
        <Txt size={40} weight="black" color={colors.ink} latin style={{ marginTop: 16 }}>
          Sun Ray
        </Txt>
        <Txt size={19} weight="extraBold" color={colors.terracotta} style={{ marginTop: -2 }}>
          سن راي
        </Txt>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 16 }}>
          <View style={{ height: 1, width: 26, backgroundColor: '#cebfa0' }} />
          <Txt size={14} weight="medium" color={colors.textMuted}>
            دائمًا كن مشرقًا
          </Txt>
          <View style={{ height: 1, width: 26, backgroundColor: '#cebfa0' }} />
        </View>
        <Txt size={11} weight="bold" latin tracking={3} color={colors.textFaint} style={{ marginTop: 6 }}>
          ALWAYS BE RADIANT
        </Txt>
      </Animated.View>
    </LinearGradient>
  );
}
