import { Platform, ViewStyle } from 'react-native';

/**
 * Warm brown-tinted shadows matching the design. Android uses elevation,
 * iOS uses shadow* props. Use via `...shadows.card`.
 */
type Shadow = Pick<
  ViewStyle,
  'shadowColor' | 'shadowOffset' | 'shadowOpacity' | 'shadowRadius' | 'elevation'
>;

const make = (
  hex: string,
  opacity: number,
  radius: number,
  offsetY: number,
  elevation: number,
): Shadow =>
  Platform.select<Shadow>({
    ios: {
      shadowColor: hex,
      shadowOffset: { width: 0, height: offsetY },
      shadowOpacity: opacity,
      shadowRadius: radius,
    },
    default: { elevation, shadowColor: hex },
  }) as Shadow;

export const shadows = {
  none: {} as Shadow,
  xs: make('#785020', 0.06, 6, 2, 1),
  sm: make('#785020', 0.08, 10, 3, 2),
  card: make('#785020', 0.08, 16, 5, 3),
  md: make('#785020', 0.1, 20, 6, 5),
  lg: make('#2a2018', 0.28, 30, 12, 9),
  gold: make('#be821e', 0.28, 30, 14, 9),
  goldStrong: make('#be821e', 0.36, 32, 14, 11),
  terracotta: make('#b5662e', 0.35, 20, 8, 8),
} as const;

export type ShadowKey = keyof typeof shadows;
