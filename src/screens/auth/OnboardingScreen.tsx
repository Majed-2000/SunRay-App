import { useRef, useState } from 'react';
import { Image, ScrollView, View, useWindowDimensions, type NativeSyntheticEvent, type NativeScrollEvent } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { colors, gradients, spacing } from '@/theme';
import { LOGO } from '@/assets';
import { Button, Txt } from '@/components';
import { useAuthStore } from '@/store';

interface Slide {
  emoji: string;
  titleAr: string;
  bodyAr: string;
}

const SLIDES: Slide[] = [
  { emoji: '☕', titleAr: 'اطلب قبل ما توصل', bodyAr: 'جهّز مشروبك المفضل من الطلب المسبق واستلمه فور وصولك للفرع دون انتظار.' },
  { emoji: '🛵', titleAr: 'توصيل لباب بيتك', bodyAr: 'اطلب قهوتك وحلاك للتوصيل وتابع طلبك لحظة بلحظة حتى يصلك دافئًا.' },
  { emoji: '⭐', titleAr: 'كل كوب يكسبك نقاط', bodyAr: 'اجمع نقاط مشرقة مع كل طلب واستبدلها بمشروبات مجانية ومكافآت حصرية.' },
];

export function OnboardingScreen() {
  const { width } = useWindowDimensions();
  const [index, setIndex] = useState(0);
  const ref = useRef<ScrollView>(null);
  const completeOnboarding = useAuthStore((s) => s.completeOnboarding);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    setIndex(Math.round(e.nativeEvent.contentOffset.x / width));
  };

  const finish = () => {
    completeOnboarding();
    router.replace('/(auth)/language');
  };

  const next = () => {
    if (index >= SLIDES.length - 1) return finish();
    ref.current?.scrollTo({ x: (index + 1) * width, animated: true });
  };

  return (
    <LinearGradient colors={gradients.screen} style={{ flex: 1 }}>
      <View style={{ flex: 1, paddingTop: 60 }}>
        <View style={{ alignItems: 'flex-start', paddingHorizontal: spacing['2xl'] }}>
          <Txt size={14} weight="bold" color={colors.textMuted} onPress={finish}>
            تخطّي
          </Txt>
        </View>

        <ScrollView
          ref={ref}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={onScroll}
          style={{ flex: 1 }}
        >
          {SLIDES.map((s) => (
            <View key={s.titleAr} style={{ width, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing['4xl'] }}>
              <View
                style={{
                  width: 180,
                  height: 180,
                  borderRadius: 90,
                  backgroundColor: colors.card,
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: spacing['3xl'],
                }}
              >
                <Txt size={84}>{s.emoji}</Txt>
              </View>
              <Txt size={26} weight="black" color={colors.ink} center>
                {s.titleAr}
              </Txt>
              <Txt size={15} color={colors.textMuted} center style={{ marginTop: 12, lineHeight: 24 }}>
                {s.bodyAr}
              </Txt>
            </View>
          ))}
        </ScrollView>

        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: spacing['3xl'] }}>
          {SLIDES.map((s, i) => (
            <View
              key={s.titleAr}
              style={{
                width: i === index ? 22 : 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: i === index ? colors.gold : colors.border,
              }}
            />
          ))}
        </View>

        <View style={{ paddingHorizontal: spacing['2xl'], paddingBottom: spacing['4xl'], flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Image source={LOGO} style={{ width: 36, height: 36 }} />
          <View style={{ flex: 1 }}>
            <Button label={index >= SLIDES.length - 1 ? 'ابدأ الآن' : 'التالي'} onPress={next} />
          </View>
        </View>
      </View>
    </LinearGradient>
  );
}
