/**
 * Typography — Tajawal for Arabic UI, Plus Jakarta Sans for Latin labels/numbers.
 * Font family keys map to the names registered in app/_layout.tsx via expo-font.
 */
export const fonts = {
  // Arabic (Tajawal)
  light: 'Tajawal_300Light',
  regular: 'Tajawal_400Regular',
  medium: 'Tajawal_500Medium',
  bold: 'Tajawal_700Bold',
  extraBold: 'Tajawal_800ExtraBold',
  black: 'Tajawal_900Black',
  // Latin (Plus Jakarta Sans) — for EN labels, code-like badges, eyebrows
  latinMedium: 'PlusJakartaSans_500Medium',
  latinSemiBold: 'PlusJakartaSans_600SemiBold',
  latinBold: 'PlusJakartaSans_700Bold',
  latinExtraBold: 'PlusJakartaSans_800ExtraBold',
} as const;

/** Type scale used across the app. */
export const fontSize = {
  xxs: 9,
  xs: 11,
  sm: 13,
  md: 15,
  base: 16,
  lg: 18,
  xl: 20,
  '2xl': 24,
  '3xl': 28,
  '4xl': 34,
  '5xl': 40,
} as const;

export const lineHeight = {
  tight: 1.2,
  snug: 1.4,
  normal: 1.6,
} as const;

export type FontFamilyKey = keyof typeof fonts;
