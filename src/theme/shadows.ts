import { Platform, ViewStyle } from 'react-native';

/**
 * Shadows, per the brand's UI spec: `rgba(67,67,68,0.10)` — light, wide, subtle.
 *
 * They were previously tinted warm brown (`#785020`), which belonged to the old
 * amber palette and reads as a dirty halo against the cream surfaces the
 * identity actually calls for. Charcoal is the brand's only dark.
 *
 * The guidelines name "high-contrast shadows" as forbidden, so the heavy
 * variants have come down: `lg` was 0.28, which under the floating cart bar
 * looked like a drop rather than a lift.
 *
 * Android uses elevation, iOS uses shadow* props. Use via `...shadows.card`.
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

/** Deep Charcoal — the shadow colour named in the brand UI spec. */
const CHARCOAL = '#434344';
/** Dark Gold. Used only for the gold "glow" the spec asks for on emphasis. */
const GOLD_GLOW = '#8a6d12';

export const shadows = {
  none: {} as Shadow,
  xs: make(CHARCOAL, 0.06, 6, 2, 1),
  sm: make(CHARCOAL, 0.08, 10, 3, 2),
  card: make(CHARCOAL, 0.1, 16, 5, 3),
  md: make(CHARCOAL, 0.1, 20, 6, 5),
  lg: make(CHARCOAL, 0.16, 30, 12, 9),
  gold: make(GOLD_GLOW, 0.22, 30, 14, 9),
  goldStrong: make(GOLD_GLOW, 0.28, 32, 14, 11),
  /** Kept for call sites that still name it; charcoal like everything else. */
  terracotta: make(CHARCOAL, 0.16, 20, 8, 8),
} as const;

export type ShadowKey = keyof typeof shadows;
