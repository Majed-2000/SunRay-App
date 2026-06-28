import { Pressable, View, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import type { Offer } from '@/data';
import { colors, gradients, radius } from '@/theme';
import { Txt } from './Txt';

export interface OfferCardProps {
  offer: Offer;
  onPress?: () => void;
  width?: number; // fixed width for horizontal strip; omit to fill
  style?: ViewStyle;
}

const VARIANT = {
  dark: { eyebrow: colors.goldBright, title: colors.white, sub: '#b8b2a8' },
  terracotta: { eyebrow: '#ffd9a8', title: colors.white, sub: '#f3dcc8' },
  gold: { eyebrow: colors.inkDeep, title: colors.inkDeep, sub: '#5a3f12' },
};

export function OfferCard({ offer, onPress, width, style }: OfferCardProps) {
  const v = VARIANT[offer.variant];
  const inner = (
    <>
      <Txt size={64} style={{ position: 'absolute', right: -10, top: -10, opacity: 0.13 }}>
        {offer.emoji}
      </Txt>
      <Txt size={10} weight="extraBold" color={v.eyebrow} tracking={1}>
        {offer.eyebrowAr}
      </Txt>
      <Txt size={17} weight="black" color={v.title} style={{ marginTop: 4, lineHeight: 22 }}>
        {offer.titleAr}
      </Txt>
      <Txt size={11} color={v.sub} style={{ marginTop: 8 }}>
        {offer.subtitleAr}
      </Txt>
    </>
  );

  const base: ViewStyle = {
    width,
    borderRadius: radius.xl,
    padding: 18,
    overflow: 'hidden',
  };

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [{ opacity: pressed ? 0.95 : 1 }, style]}>
      {offer.variant === 'dark' ? (
        <View style={[base, { backgroundColor: colors.ink }]}>{inner}</View>
      ) : (
        <LinearGradient
          colors={offer.variant === 'gold' ? gradients.gold : gradients.terracottaDeep}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={base}
        >
          {inner}
        </LinearGradient>
      )}
    </Pressable>
  );
}
