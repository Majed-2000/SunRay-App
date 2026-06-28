/** Corner radius scale. pill = fully rounded. */
export const radius = {
  xs: 8,
  sm: 11,
  md: 14,
  lg: 18,
  xl: 22,
  '2xl': 26,
  '3xl': 32,
  pill: 100,
  full: 999,
} as const;

export type RadiusKey = keyof typeof radius;
