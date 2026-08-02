import { Text, type TextProps, type TextStyle } from 'react-native';
import { colors, fonts, type FontFamilyKey } from '@/theme';

type Weight = 'light' | 'regular' | 'medium' | 'bold' | 'extraBold' | 'black';

const WEIGHT_FONT: Record<Weight, FontFamilyKey> = {
  light: 'light',
  regular: 'regular',
  medium: 'medium',
  bold: 'bold',
  extraBold: 'extraBold',
  black: 'black',
};

const LATIN_FONT: Record<Weight, FontFamilyKey> = {
  light: 'latinMedium',
  regular: 'latinMedium',
  medium: 'latinMedium',
  bold: 'latinSemiBold',
  extraBold: 'latinBold',
  black: 'latinExtraBold',
};

export interface TxtProps extends TextProps {
  size?: number;
  weight?: Weight;
  color?: string;
  /** Use Plus Jakarta Sans (for Latin labels / eyebrows). */
  latin?: boolean;
  center?: boolean;
  /** Letter spacing, useful for Latin eyebrow labels. */
  tracking?: number;
}

/** Brand text primitive — applies Tajawal (or Jakarta) and sane defaults. */
export function Txt({
  size = 15,
  weight = 'regular',
  color = colors.textPrimary,
  latin = false,
  center,
  tracking,
  style,
  ...rest
}: TxtProps) {
  const fontFamily = fonts[latin ? LATIN_FONT[weight] : WEIGHT_FONT[weight]];
  const base: TextStyle = {
    fontFamily,
    fontSize: size,
    color,
    textAlign: center ? 'center' : undefined,
    letterSpacing: tracking,
    writingDirection: latin ? 'ltr' : 'rtl',
  };

  /**
   * Text used as a link gets treated as one.
   *
   * A handful of screens hang `onPress` straight off a 13px line — "تعيين
   * كافتراضي", "حذف", "إعادة إرسال الرمز", "تخطّي". A line of 13px type is an
   * ~18px tall target, less than half the 44px minimum, with no press feedback
   * and nothing for a screen reader to announce. People tapped and nothing
   * happened, which reads as a dead button rather than a near miss.
   *
   * Fixing it here rather than at each call site keeps the ergonomics attached
   * to the affordance: any text that becomes tappable later gets them too.
   * `pressRetentionOffset` matters as much as `hitSlop` — without it, drifting a
   * couple of pixels during the tap cancels the press outright.
   */
  const tappable = Boolean(rest.onPress || rest.onLongPress);

  return (
    <Text
      {...(tappable
        ? {
            accessibilityRole: 'button' as const,
            hitSlop: { top: 12, bottom: 12, left: 8, right: 8 },
            pressRetentionOffset: { top: 16, bottom: 16, left: 12, right: 12 },
          }
        : null)}
      {...rest}
      style={[base, style]}
    />
  );
}
