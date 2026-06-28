export { colors, gradients } from './colors';
export type { AppColors } from './colors';
export { fonts, fontSize, lineHeight } from './typography';
export type { FontFamilyKey } from './typography';
export { spacing } from './spacing';
export { radius } from './radius';
export { shadows } from './shadows';
export type { ShadowKey } from './shadows';
export { breakpoints, deviceClassForWidth } from './breakpoints';
export type { DeviceClass } from './breakpoints';

import { colors, gradients } from './colors';
import { fonts, fontSize, lineHeight } from './typography';
import { spacing } from './spacing';
import { radius } from './radius';
import { shadows } from './shadows';

/** Single theme object for convenient imports: `import { theme } from '@/theme'`. */
export const theme = {
  colors,
  gradients,
  fonts,
  fontSize,
  lineHeight,
  spacing,
  radius,
  shadows,
} as const;

export type Theme = typeof theme;
