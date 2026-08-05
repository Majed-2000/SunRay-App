/**
 * Typography — the brand faces, per https://sunray.sa/sunray-profile/
 *
 *   Arabic   → Baloo Bhaijaan 2
 *   Latin    → Poppins
 *   Wordmark → Biome W01 Black (900 only, and only for "SUN RAY")
 *
 * The app previously ran on Tajawal + Plus Jakarta Sans, neither of which is in
 * the identity.
 *
 * ⚠️ Baloo Bhaijaan 2 is distributed as a VARIABLE font, and React Native
 * cannot select a weight axis — loading the variable file renders every weight
 * at 400 with no error, silently flattening the whole type hierarchy. These
 * families therefore come from `@expo-google-fonts/*`, which ships one static
 * file per weight. Same typefaces; a form React Native can actually draw.
 *
 * Biome is the exception: it is a licensed Monotype face, absent from Google
 * Fonts, so it is bundled from `assets/fonts/` and registered in _layout.tsx.
 *
 * ⚠️ The brand asks for Baloo at 900. The family's axis stops at 800 — there is
 * no 900 to load. The scale below is shifted down a step so `black`,
 * `extraBold` and `bold` stay visually distinct instead of collapsing onto the
 * single heaviest weight, which is what a naive 1:1 remap would have done.
 */
export const fonts = {
  // Arabic (Baloo Bhaijaan 2). Baloo has no 300, so `light` shares 400.
  light: 'BalooBhaijaan2_400Regular',
  regular: 'BalooBhaijaan2_400Regular',
  medium: 'BalooBhaijaan2_500Medium',
  bold: 'BalooBhaijaan2_600SemiBold',
  extraBold: 'BalooBhaijaan2_700Bold',
  black: 'BalooBhaijaan2_800ExtraBold',
  // Latin (Poppins) — EN labels, eyebrows, figures
  latinMedium: 'Poppins_400Regular',
  latinSemiBold: 'Poppins_500Medium',
  latinBold: 'Poppins_600SemiBold',
  latinExtraBold: 'Poppins_700Bold',
  /** "SUN RAY" only. The identity forbids any other face for the wordmark. */
  wordmark: 'BiomeW01-Black',
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
