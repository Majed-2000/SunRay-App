import { Image, View, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import type { GiftDesign } from '@/types';
import { colors, radius } from '@/theme';
import { toArabicDigits } from '@/utils/numerals';
import { LOGO } from '@/assets';
import { Txt } from './Txt';

export interface GiftCardPreviewProps {
  design: GiftDesign;
  amount: number;
  /** Bottom strip — left label and right value (e.g. recipient phone). */
  footerStart?: string;
  footerEnd?: string;
  size?: 'sm' | 'lg';
  style?: ViewStyle;
}

export function GiftCardPreview({
  design,
  amount,
  footerStart = 'Sun Ray',
  footerEnd,
  size = 'lg',
  style,
}: GiftCardPreviewProps) {
  const big = size === 'lg';
  return (
    <View
      style={[
        {
          borderRadius: radius['2xl'],
          overflow: 'hidden',
          shadowColor: '#000',
          shadowOpacity: 0.18,
          shadowRadius: 18,
          shadowOffset: { width: 0, height: 10 },
          elevation: 8,
        },
        style,
      ]}
    >
      <LinearGradient colors={design.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
        <Txt size={big ? 120 : 72} style={{ position: 'absolute', top: big ? -30 : -20, right: big ? -24 : -18, opacity: 0.12, color: '#fff' }}>
          ☀
        </Txt>
        <View style={{ padding: big ? 24 : 16, paddingBottom: big ? 12 : 8 }}>
          <Image source={LOGO} style={{ width: big ? 44 : 32, height: big ? 44 : 32 }} />
          <Txt
            size={big ? 11 : 9}
            weight="extraBold"
            latin
            tracking={2}
            color={design.labelColor}
            style={{ marginTop: big ? 12 : 8 }}
          >
            GIFT CARD · SUN RAY
          </Txt>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', marginTop: 4 }}>
            <Txt size={big ? 48 : 28} weight="black" color={colors.white} style={{ lineHeight: big ? 52 : 30 }}>
              {toArabicDigits(amount)}
            </Txt>
            <Txt size={big ? 18 : 13} weight="bold" color={colors.white}>
              {' '}
              ﷼
            </Txt>
          </View>
          {big ? (
            <Txt size={12} latin color="rgba(255,255,255,0.7)" style={{ marginTop: 4 }}>
              Always Be Radiant
            </Txt>
          ) : null}
        </View>
        <View
          style={{
            backgroundColor: 'rgba(0,0,0,0.20)',
            paddingHorizontal: big ? 24 : 16,
            paddingVertical: big ? 14 : 10,
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <Txt size={big ? 12 : 11} color="rgba(255,255,255,0.8)" weight="bold">
            {footerStart}
          </Txt>
          {footerEnd ? (
            <Txt size={big ? 13 : 11} weight="extraBold" color={colors.white}>
              {footerEnd}
            </Txt>
          ) : null}
        </View>
      </LinearGradient>
    </View>
  );
}
