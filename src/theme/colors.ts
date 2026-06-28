/**
 * Sun Ray palette — extracted directly from the design prototype (Sun Ray.dc.html).
 * Warm, golden, cafe-inspired. Dark ink + sunflower gold + terracotta on cream.
 */
export const colors = {
  // Surfaces
  bg: '#efe6d6', // app warm cream background
  bgWarm: '#f6eedd', // lighter cream (gradient top)
  bgDeep: '#e7d9c0', // deeper cream (gradient edge)
  card: '#ffffff',
  cardAlt: '#faf6ee', // sheets / alt surfaces
  chip: '#f6efe1', // soft chip background
  chipGold: '#faf3e6', // gold-tinted chip
  chipGoldStrong: '#f3e8d0',
  chipCream: '#fbe9c4',

  // Ink / text
  ink: '#2a2018', // primary dark (buttons, headings)
  inkDeep: '#2a1c08', // deepest brown-black (on-gold text)
  textPrimary: '#2a2018',
  textSecondary: '#6b5f48',
  textMuted: '#8a7c60',
  textFaint: '#a08c66',
  textOnDark: '#ffffff',
  textOnDarkMuted: '#b8b2a8',
  textGoldSoft: '#c9b88e',

  // Brand accents
  gold: '#e0a82e', // primary gold accent
  goldBright: '#e7ad30',
  goldDeep: '#cf8b22',
  goldText: '#f5c96a', // gold text on dark surfaces
  terracotta: '#b5662e', // secondary warm brown
  terracottaDeep: '#9c5224',

  // States
  success: '#3f9d6a',
  danger: '#b5392e',
  dangerSoft: '#f3e3df',
  notification: '#d8492e',

  // Lines & borders
  border: '#eadfca',
  borderSoft: '#ede4d2',
  borderDashed: '#e6dcc8',
  divider: '#e4d8c0',

  // Misc
  overlay: 'rgba(42,32,18,0.45)',
  shimmerFrom: '#ece0c8',
  shimmerTo: '#f8efdc',
  white: '#ffffff',
  transparent: 'transparent',
} as const;

/** Reusable brand gradients (use with expo-linear-gradient). */
export const gradients = {
  gold: ['#e7ad30', '#cf8b22'] as const,
  goldSoft: ['#e0a82e', '#d18f24'] as const,
  terracotta: ['#b5662e', '#9c5224'] as const,
  terracottaDeep: ['#b5662e', '#9c4f20'] as const,
  dark: ['#2a2018', '#4a3820'] as const,
  loyalty: ['#e7ad30', '#cf8b22'] as const,
  screen: ['#f6eedd', '#efe6d6'] as const,
};

export type AppColors = typeof colors;
