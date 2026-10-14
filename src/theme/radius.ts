/**
 * Corner radius scale. pill = fully rounded.
 *
 * The brand UI spec calls for 14–16px on surfaces. `md` and `lg` are the two
 * that cards and buttons actually use, so they sit inside that band; `lg` came
 * down from 18. The larger steps remain for hero surfaces where the spec's
 * "soft, rounded" intent still holds.
 */
export const radius = {
  xs: 8,
  sm: 11,
  md: 14,
  lg: 16,
  xl: 22,
  '2xl': 26,
  '3xl': 32,
  pill: 100,
  full: 999,
} as const;

export type RadiusKey = keyof typeof radius;
