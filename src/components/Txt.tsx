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
  return <Text {...rest} style={[base, style]} />;
}
