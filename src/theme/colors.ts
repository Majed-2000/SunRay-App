/**
 * Sun Ray palette — the official brand identity, https://sunray.sa/sunray-profile/
 *
 * The app previously ran on a warm brown-and-amber palette taken from an early
 * prototype. It was a different palette entirely, not a drifted one: brown ink
 * where the brand specifies neutral charcoal, amber where the brand specifies a
 * bright radiant gold, and a terracotta accent that appears nowhere in the
 * identity at all.
 *
 * The brand distributes colour 60-30-10:
 *   60% cream and white surfaces · 30% charcoal text · 10% gold emphasis.
 *
 * The 10% is a ceiling, and it is the reason `gold` below must never carry
 * text. Radiant Gold on white measures 1.38:1 — it is a fill colour. Gold
 * *text* is `goldDeep`, which is a different brand colour with a different job.
 */

/** Radiant Gold — fills, active states, emphasis. NEVER text on a light surface. */
const RADIANT_GOLD = '#fcda4c';
/** Dark Gold — the readable gold. Text, icons, links. 4.91:1 on white. */
const DARK_GOLD = '#8a6d12';
/** Deep Charcoal — every piece of primary text. Neutral grey, not brown. */
const CHARCOAL = '#434344';

export const colors = {
  // Surfaces — the 60%
  bg: '#f7f3e6', // Light Cream: primary app background
  bgWarm: '#fbf5d5', // Cream: warmer sections, gradient top
  bgDeep: '#f0e9d2', // deeper cream edge, derived for gradient depth only
  card: '#ffffff',
  cardAlt: '#fbf5d5', // sheets / alt surfaces
  chip: '#f7f3e6', // soft chip background
  chipGold: '#fdf0c4', // gold-tinted chip (radiant gold at low opacity over cream)
  chipGoldStrong: '#fce9a8',
  chipCream: '#fbf5d5',

  // Ink / text — the 30%
  ink: CHARCOAL,
  inkDeep: '#2f2f30', // pressed/darker charcoal, and text on gold fills
  textPrimary: CHARCOAL,
  /**
   * The secondary ramp, three distinct steps that all clear AA (4.5:1) on both
   * white cards and the cream background.
   *
   * The old ramp did not: its `textFaint` measured 2.63:1 on the page and
   * 3.26:1 on a card — well under AA, and the app leans on it for hints, dates
   * and captions. That failure predates this rebrand, but the palette is being
   * rewritten, so it gets fixed rather than carried across. These read lighter
   * than the primary charcoal without becoming unreadable, which is the whole
   * job; text too faint to read is not a design feature.
   */
  textSecondary: '#55555a',
  textMuted: '#63636a',
  textFaint: '#6f6f73',
  textOnDark: '#ffffff',
  textOnDarkMuted: '#c4c4c6',
  textGoldSoft: '#c9b88e',

  // Brand accents — the 10%
  /** Fills, badges, active states. Not text: 1.38:1 on white. */
  gold: RADIANT_GOLD,
  goldBright: '#fde16b',
  /** The readable gold. Use for gold text and icons. */
  goldDeep: DARK_GOLD,
  /** Gold text on DARK surfaces only — 7.19:1 on charcoal. */
  goldText: RADIANT_GOLD,

  /**
   * Secondary and tertiary brand accents. Defined because they are part of the
   * identity, deliberately not yet used broadly — the owner chose a gold-led
   * palette over introducing them across the app.
   *
   * ⚠️ `olive` takes WHITE text (4.61:1). Charcoal on olive is 2.15:1 and is
   * named as a forbidden combination in the brand guidelines themselves.
   */
  green: '#96d0a5',
  olive: '#527f5f',

  // States — functional, not brand identity
  /** Darkened from #3f9d6a, which was only 3.08:1 on its own tint. */
  success: '#317a52',
  /** Success tint, derived from the brand green so it sits in the family. */
  successSoft: '#eef7f0',
  danger: '#b5392e',
  dangerSoft: '#f6e5e3',
  notification: '#d8492e',

  // Lines & borders
  border: '#e8e0c8',
  borderSoft: '#efe9d8',
  borderDashed: '#e6ddc6',
  divider: '#e4dcc6',

  // Misc
  overlay: 'rgba(67,67,68,0.45)',
  shimmerFrom: '#ece5cf',
  shimmerTo: '#f8f3e2',
  white: '#ffffff',
  transparent: 'transparent',
} as const;

/**
 * Brand gradients.
 *
 * Deliberately few and shallow. The identity calls for calm surfaces with gold
 * carrying emphasis, so the old amber→bronze ramp is gone: gold is now flat
 * Radiant Gold, and what used to be a terracotta ramp is charcoal.
 */
export const gradients = {
  gold: [RADIANT_GOLD, RADIANT_GOLD] as const,
  goldSoft: [RADIANT_GOLD, '#f5cf3f'] as const,
  /**
   * Olive — the brand's secondary accent, and the second dark surface.
   *
   * This replaces the terracotta ramp. Making it charcoal too would have
   * rendered it identical to `dark` and quietly collapsed two distinct offer
   * looks into one. Olive keeps them apart using a colour the identity
   * actually has. ⚠️ Light text only: charcoal on olive is 2.15:1.
   */
  olive: ['#527f5f', '#456b50'] as const,
  dark: [CHARCOAL, '#2f2f30'] as const,
  loyalty: [RADIANT_GOLD, '#f5cf3f'] as const,
  screen: ['#fbf5d5', '#f7f3e6'] as const,
};

export type AppColors = typeof colors;
