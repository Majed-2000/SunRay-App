/** Spacing scale (px). screenX is the standard horizontal screen padding. */
export const spacing = {
  none: 0,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 18,
  '2xl': 22,
  '3xl': 28,
  '4xl': 36,
  '5xl': 48,
  screenX: 18,
} as const;

export type SpacingKey = keyof typeof spacing;
