/**
 * Sun Ray icon glyphs — drawing data only, no React.
 *
 * The style follows the logo: a charcoal outline with round ends, and one gold
 * fill tucked inside it — the coffee in the cup, the ribbon on the gift — the
 * way the sunflower's gold petals sit inside their charcoal line. Gold is the
 * brand's 10%, so it is never the outline and never more than one part.
 *
 * Grid: 24 × 24, stroke 1.75 at size 24, round caps and joins, 2px inset.
 *
 * Each glyph is a list of parts drawn in this order: `accent` fills (gold, no
 * stroke) → outlines (stroked, no fill) → `ink` fills (solid charcoal: dots,
 * the sunflower's centre). Kept as data so the same drawing renders in the app
 * (`Icon.tsx`) and in a plain SVG preview.
 */

export interface GlyphPart {
  /** SVG path data. */
  d?: string;
  /** A circle: [cx, cy, r]. */
  circle?: [number, number, number];
  /** accent = gold fill, ink = solid charcoal fill, default = outline. */
  kind?: 'accent' | 'ink';
  /** Thinner outline, for small repeated parts (the sunflower's petals). */
  thin?: boolean;
}

/** Ten petals around a charcoal centre — the logo, reduced to icon size. */
function sunflower(): GlyphPart[] {
  const parts: GlyphPart[] = [];
  const cx = 12;
  const cy = 12;
  const n = 10;
  const rIn = 4.2;
  const rOut = 11;
  const half = 0.36; // petal half-width in radians at its widest
  const f = (x: number) => Math.round(x * 100) / 100;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 - Math.PI / 2;
    const p0 = [cx + rIn * Math.cos(a), cy + rIn * Math.sin(a)];
    const p1 = [cx + rOut * Math.cos(a), cy + rOut * Math.sin(a)];
    const rMid = (rIn + rOut) / 2 + 0.6;
    const c1 = [cx + rMid * Math.cos(a - half), cy + rMid * Math.sin(a - half)];
    const c2 = [cx + rMid * Math.cos(a + half), cy + rMid * Math.sin(a + half)];
    const d = `M${f(p0[0])} ${f(p0[1])}Q${f(c1[0])} ${f(c1[1])} ${f(p1[0])} ${f(p1[1])}Q${f(c2[0])} ${f(c2[1])} ${f(p0[0])} ${f(p0[1])}Z`;
    parts.push({ d, kind: 'accent' }, { d, thin: true });
  }
  parts.push({ circle: [cx, cy, 4.3], kind: 'ink' });
  return parts;
}

export const GLYPHS = {
  // ── Brand ────────────────────────────────────────────────────────────────
  sun: sunflower(),

  // ── Drinks & food ────────────────────────────────────────────────────────
  'cup-hot': [
    { d: 'M5 12.5h12v3a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4Z', kind: 'accent' },
    { d: 'M5 9h12v6.5a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4Z' },
    { d: 'M17 11h1.25a2.5 2.5 0 0 1 0 5H17' },
    { d: 'M8.75 3.5c-.9 1.1.9 2.1 0 3.25' },
    { d: 'M12.75 3.5c-.9 1.1.9 2.1 0 3.25' },
  ],
  'cup-iced': [
    { d: 'M7.95 13h8.1l-.6 7.5h-6.9Z', kind: 'accent' },
    { d: 'M6 7.5h12' },
    { d: 'M6.75 7.5a5.25 2.75 0 0 1 10.5 0' },
    { d: 'M7.4 7.5 8.6 20.5h6.8l1.2-13' },
    { d: 'M12.5 5 14 2.25h2.5' },
    { d: 'M9.75 10.25h2v2h-2Z' },
    { d: 'M12.75 11.5h2v2h-2Z' },
  ],
  matcha: [
    { d: 'M4 12.5h16a8 1.75 0 0 1-16 0Z', kind: 'accent' },
    { d: 'M3.5 12h17a8.5 7.5 0 0 1-17 0Z' },
    { d: 'M9 20.5h6' },
    { d: 'M12 9.25c-2.1-1.2-2.1-4.3 0-5.5 2.1 1.2 2.1 4.3 0 5.5Z' },
    { d: 'M12 9.25v-3' },
  ],
  pourover: [
    { d: 'M7.5 17.25h9v1.25a2 2 0 0 1-2 2h-5a2 2 0 0 1-2-2Z', kind: 'accent' },
    { d: 'M3.75 4.75h16.5' },
    { d: 'M5.25 4.75 9.5 11.5h5l4.25-6.75' },
    { d: 'M12 13v1' },
    { d: 'M7.5 15.25h9v3.25a2 2 0 0 1-2 2h-5a2 2 0 0 1-2-2Z' },
  ],
  jug: [
    { d: 'M6 14.5h12v3a3 3 0 0 1-3 3H9a3 3 0 0 1-3-3Z', kind: 'accent' },
    { d: 'M8.5 3.5h7l-1 3.25 3.5 4.25v6.5a3 3 0 0 1-3 3H9a3 3 0 0 1-3-3V11l3.5-4.25Z' },
    { d: 'M18 12h1a1.75 1.75 0 0 1 1.75 1.75v1.5A1.75 1.75 0 0 1 19 17h-1' },
    { d: 'M9.5 6.75h5' },
  ],
  beans: [
    { d: 'M12 3.75c3.9 0 6.5 3.7 6.5 8.25S15.9 20.25 12 20.25 5.5 16.55 5.5 12 8.1 3.75 12 3.75Z', kind: 'accent' },
    { d: 'M12 3.75c3.9 0 6.5 3.7 6.5 8.25S15.9 20.25 12 20.25 5.5 16.55 5.5 12 8.1 3.75 12 3.75Z' },
    { d: 'M12.25 3.9c-2.4 2.7-2.4 5.3 0 8.1s2.4 5.4 0 8.1' },
  ],
  pastry: [
    { d: 'M4 15.5A8 7 0 0 1 20 15.5v1.25H4Z', kind: 'accent' },
    { d: 'M4 17.25v-1.75a8 7 0 0 1 16 0v1.75a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1Z' },
    { d: 'M8.5 11.5l1.5 2.25M12.25 10.25l1.5 2.25M16 11.5l.75 1.25' },
  ],
  dessert: [
    { d: 'M4 14.25 20 11v4.25H4Z', kind: 'accent' },
    { d: 'M4 19.75h16V9.5L4 12.5Z' },
    { d: 'M4 12.5 13.5 5.25 20 9.5' },
    { d: 'M4 16.75h16' },
    { circle: [15.75, 4.5, 1.35], kind: 'ink' },
  ],
  sandwich: [
    { d: 'M5.8 16.25h12.4l1.3 2.25h-15Z', kind: 'accent' },
    { d: 'M4.5 18.5 12 5.5l7.5 13Z' },
    { d: 'M5.8 16.25h12.4' },
    { d: 'M7.1 14c1.3-.8 2.5.8 3.8 0s2.5.8 3.8 0 1.5-.3 2.2 0' },
  ],
  water: [
    { d: 'M7.4 14.25h9.2a4.6 4.6 0 0 1-9.2 0Z', kind: 'accent' },
    { d: 'M12 3.5c3.6 4.4 5.5 7.6 5.5 10.5a5.5 5.5 0 0 1-11 0C6.5 11.1 8.4 7.9 12 3.5Z' },
  ],
  cookie: [
    { circle: [12, 12, 8.25] },
    { circle: [9, 9.5, 1.15], kind: 'ink' },
    { circle: [14.75, 8.75, 1], kind: 'ink' },
    { circle: [14, 14.25, 1.15], kind: 'ink' },
    { circle: [8.75, 15, 1], kind: 'ink' },
  ],
  'cake-birthday': [
    { d: 'M4.5 14.5h15v5.5h-15Z', kind: 'accent' },
    { d: 'M4.5 11.5h15v8.75h-15Z' },
    { d: 'M4.5 14.5c1.25 1 2.5 1 3.75 0s2.5-1 3.75 0 2.5 1 3.75 0 2.5-1 3.75 0' },
    { d: 'M12 11.5V8.5' },
    { d: 'M12 6.25c-.75-.8-.75-1.9 0-2.75.75.85.75 1.95 0 2.75Z' },
  ],

  // ── Ordering ─────────────────────────────────────────────────────────────
  car: [
    { d: 'M6.3 11.75 7.9 8.5h8.2l1.6 3.25Z', kind: 'accent' },
    { d: 'M3.5 16.25v-3.5l2.1-4.4A2 2 0 0 1 7.4 7.25h9.2a2 2 0 0 1 1.8 1.1l2.1 4.4v3.5a.75.75 0 0 1-.75.75H4.25a.75.75 0 0 1-.75-.75Z' },
    { d: 'M4 12.75h16' },
    { circle: [7.75, 17, 1.9] },
    { circle: [16.25, 17, 1.9] },
  ],
  scooter: [
    { d: 'M9 12.5h5.5l-1.25 3.5H9.5Z', kind: 'accent' },
    { circle: [6, 17, 2.25] },
    { circle: [18, 17, 2.25] },
    { d: 'M8.25 17h5l2.75-9h2.5' },
    { d: 'M4 13.25h5.5l1.5 3.75' },
  ],
  bag: [
    { d: 'M5.5 12h13l-.7 7.1a1.6 1.6 0 0 1-1.6 1.4H7.8a1.6 1.6 0 0 1-1.6-1.4Z', kind: 'accent' },
    { d: 'M4.75 8h14.5l-1.45 11.1a1.6 1.6 0 0 1-1.6 1.4H7.8a1.6 1.6 0 0 1-1.6-1.4Z' },
    { d: 'M8.75 8V6.75a3.25 3.25 0 0 1 6.5 0V8' },
  ],
  receipt: [
    { d: 'M8.75 7.25h6.5v1.75h-6.5Z', kind: 'accent' },
    { d: 'M5.75 3.25h12.5v17.5l-2.1-1.5-2.05 1.5-2.1-1.5-2.05 1.5-2.1-1.5-2.1 1.5Z' },
    { d: 'M8.75 8.1h6.5M8.75 11.75h6.5M8.75 15.25h4' },
  ],
  timer: [
    { d: 'M12 13V8.5A4.5 4.5 0 0 1 16.5 13Z', kind: 'accent' },
    { circle: [12, 13, 7.5] },
    { d: 'M12 13V9' },
    { d: 'M9.5 2.75h5' },
    { d: 'M18.5 6.5l1.25-1.25' },
  ],
  flame: [
    { d: 'M12 20.5a3.5 3.5 0 0 1-3.5-3.5c0-2.4 2.3-3.8 3.5-6 1.2 2.2 3.5 3.6 3.5 6a3.5 3.5 0 0 1-3.5 3.5Z', kind: 'accent' },
    { d: 'M12 20.5a6.5 6.5 0 0 1-6.5-6.5c0-4.2 3.6-6.4 5.1-10.5 1 2.2 2.6 3.2 3.4 5 .6-1.1 1.4-1.7 1.9-2.6 1.6 2.3 2.6 4.8 2.6 8.1a6.5 6.5 0 0 1-6.5 6.5Z' },
  ],
  pin: [
    { circle: [12, 10, 2.75], kind: 'accent' },
    { d: 'M12 21s-6.75-5.9-6.75-11A6.75 6.75 0 0 1 18.75 10C18.75 15.1 12 21 12 21Z' },
    { circle: [12, 10, 2.75] },
  ],
  store: [
    { d: 'M3.5 9.25h17v1.5a2.8 2.8 0 0 1-5.65 0 2.85 2.85 0 0 1-5.7 0 2.8 2.8 0 0 1-5.65 0Z', kind: 'accent' },
    { d: 'M5 4h14l1.5 5.25H3.5Z' },
    { d: 'M3.5 9.25v1.5a2.8 2.8 0 0 0 5.65 0 2.85 2.85 0 0 0 5.7 0 2.8 2.8 0 0 0 5.65 0v-1.5' },
    { d: 'M5 13v7.5h14V13' },
    { d: 'M10 20.5v-4.25h4v4.25' },
  ],

  // ── Account & rewards ────────────────────────────────────────────────────
  gift: [
    { d: 'M10.75 8.5h2.5v12h-2.5Z', kind: 'accent' },
    { d: 'M4.5 11.5h15v9h-15Z' },
    { d: 'M3.25 8.5h17.5v3H3.25Z' },
    { d: 'M12 8.5v12' },
    { d: 'M12 8.5C10.5 5.25 7 4.9 7 6.9 7 8.3 9 8.5 12 8.5c3 0 5-.2 5-1.6 0-2-3.5-1.65-5 1.6Z' },
  ],
  tag: [
    { circle: [8.25, 8.25, 1.6], kind: 'accent' },
    { d: 'M3.5 4.5v6.1a1.5 1.5 0 0 0 .45 1.05l8.9 8.9a1.5 1.5 0 0 0 2.1 0l5.5-5.5a1.5 1.5 0 0 0 0-2.1l-8.9-8.9a1.5 1.5 0 0 0-1.05-.45H4.5a1 1 0 0 0-1 1Z' },
    { circle: [8.25, 8.25, 1.6] },
  ],
  ticket: [
    { d: 'M15 6h4.25a1.25 1.25 0 0 1 1.25 1.25V10a2 2 0 0 0 0 4v2.75A1.25 1.25 0 0 1 19.25 18H15Z', kind: 'accent' },
    { d: 'M3.5 7.25A1.25 1.25 0 0 1 4.75 6h14.5a1.25 1.25 0 0 1 1.25 1.25V10a2 2 0 0 0 0 4v2.75A1.25 1.25 0 0 1 19.25 18H4.75a1.25 1.25 0 0 1-1.25-1.25V14a2 2 0 0 0 0-4Z' },
    { d: 'M15 6.5v1.5M15 11.25v1.5M15 16v1.5' },
  ],
  wallet: [
    { d: 'M15.5 11.5h5v4h-5a2 2 0 0 1 0-4Z', kind: 'accent' },
    { d: 'M4 6.75A1.75 1.75 0 0 1 5.75 5H17v3' },
    { d: 'M4 6.75v11A1.75 1.75 0 0 0 5.75 19.5h13a1.75 1.75 0 0 0 1.75-1.75V9.75A1.75 1.75 0 0 0 18.75 8H5.75A1.75 1.75 0 0 1 4 6.25' },
    { d: 'M15.5 11.5h5v4h-5a2 2 0 0 1 0-4Z' },
  ],
  card: [
    { d: 'M3.5 9h17v2.5h-17Z', kind: 'accent' },
    { d: 'M5 5.5h14a1.5 1.5 0 0 1 1.5 1.5v10a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 17V7A1.5 1.5 0 0 1 5 5.5Z' },
    { d: 'M3.5 9.25h17M7 15h3' },
  ],
  people: [
    { circle: [9, 8, 3], kind: 'accent' },
    { circle: [9, 8, 3] },
    { d: 'M3.5 19.5a5.5 5.5 0 0 1 11 0' },
    { d: 'M15.5 5.25a3 3 0 0 1 0 5.5' },
    { d: 'M17 14.25a5.5 5.5 0 0 1 3.5 5.25' },
  ],
  seat: [
    { d: 'M6.5 12.5h11v2.5h-11Z', kind: 'accent' },
    { d: 'M7.5 4h9a1 1 0 0 1 1 1v7.5h-11V5a1 1 0 0 1 1-1Z' },
    { d: 'M5.5 12.5h13v2.5h-13Z' },
    { d: 'M7 15v5M17 15v5' },
  ],
  dine: [
    { d: 'M6 3.5v5a2 2 0 0 0 4 0v-5M8 10.5v10' },
    { d: 'M16.5 20.5v-17c-2 1.5-3 4-3 7.5h3' },
  ],

  // ── Status & feedback ────────────────────────────────────────────────────
  check: [
    { circle: [12, 12, 8.75], kind: 'accent' },
    { circle: [12, 12, 8.75] },
    { d: 'M8.25 12.25l2.5 2.5 5-5' },
  ],
  sparkle: [
    { d: 'M11 3c.6 4.1 2 5.5 6 6-4 .6-5.4 2-6 6-.6-4-2-5.4-6-6 4-.5 5.4-1.9 6-6Z', kind: 'accent' },
    { d: 'M11 3c.6 4.1 2 5.5 6 6-4 .6-5.4 2-6 6-.6-4-2-5.4-6-6 4-.5 5.4-1.9 6-6Z' },
    { d: 'M18 14.5c.3 1.7.9 2.3 2.5 2.5-1.6.3-2.2.9-2.5 2.5-.3-1.6-.9-2.2-2.5-2.5 1.6-.2 2.2-.8 2.5-2.5Z' },
  ],
  alert: [
    { d: 'M10.4 4.9a1.85 1.85 0 0 1 3.2 0l7.05 12.4a1.85 1.85 0 0 1-1.6 2.7H4.95a1.85 1.85 0 0 1-1.6-2.7Z', kind: 'accent' },
    { d: 'M10.4 4.9a1.85 1.85 0 0 1 3.2 0l7.05 12.4a1.85 1.85 0 0 1-1.6 2.7H4.95a1.85 1.85 0 0 1-1.6-2.7Z' },
    { d: 'M12 9.5v4' },
    { circle: [12, 16.6, 1.05], kind: 'ink' },
  ],
  info: [
    { circle: [12, 12, 8.75] },
    { d: 'M12 11v5.25' },
    { circle: [12, 7.9, 1.05], kind: 'ink' },
  ],
  lock: [
    { circle: [12, 15.25, 1.4], kind: 'ink' },
    { d: 'M7 11h10a1.5 1.5 0 0 1 1.5 1.5v6.25A1.75 1.75 0 0 1 16.75 20.5h-9.5A1.75 1.75 0 0 1 5.5 18.75V12.5A1.5 1.5 0 0 1 7 11Z' },
    { d: 'M8.5 11V8a3.5 3.5 0 0 1 7 0v3' },
  ],
  bell: [
    { d: 'M9.75 19.25a2.25 2.25 0 0 0 4.5 0Z', kind: 'accent' },
    { d: 'M6 16.75V11a6 6 0 0 1 12 0v5.75l1.5 1.5h-15Z' },
    { d: 'M9.75 19.25a2.25 2.25 0 0 0 4.5 0' },
    { d: 'M12 3.25V5' },
  ],
  search: [
    { circle: [10.5, 10.5, 4.25], kind: 'accent' },
    { circle: [10.5, 10.5, 6.25] },
    { d: 'M15.25 15.25 20.5 20.5' },
  ],
  hourglass: [
    { d: 'M8.5 18.75c0-1.9 3.5-3.25 3.5-3.25s3.5 1.35 3.5 3.25Z', kind: 'accent' },
    { d: 'M6.5 3.5h11M6.5 20.5h11' },
    { d: 'M7.75 3.5c0 4.5 4.25 5.75 4.25 8.5s-4.25 4-4.25 8.5M16.25 3.5c0 4.5-4.25 5.75-4.25 8.5s4.25 4 4.25 8.5' },
  ],
  offline: [
    { d: 'M3.5 9.5a12.5 12.5 0 0 1 4.3-2.6M12 6.5a12.4 12.4 0 0 1 8.5 3' },
    { d: 'M6.75 12.9a7.75 7.75 0 0 1 3-1.7M14.4 11.5a7.7 7.7 0 0 1 2.85 1.4' },
    { circle: [12, 17.5, 1.4], kind: 'ink' },
    { d: 'M4 4l16 16' },
  ],
  chat: [
    { d: 'M8 10.5h8M8 13.75h5' },
    { d: 'M5 4.5h14A1.5 1.5 0 0 1 20.5 6v9.5A1.5 1.5 0 0 1 19 17h-8.25L6 20.5V17H5a1.5 1.5 0 0 1-1.5-1.5V6A1.5 1.5 0 0 1 5 4.5Z' },
  ],
  note: [
    { d: 'M14.5 3.5v4.25h4.25L14.5 3.5Z', kind: 'accent' },
    { d: 'M14.5 3.5H6.75A1.25 1.25 0 0 0 5.5 4.75v14.5a1.25 1.25 0 0 0 1.25 1.25h10.5a1.25 1.25 0 0 0 1.25-1.25V7.75Z' },
    { d: 'M14.5 3.5v4.25h4.25M8.5 12.25h7M8.5 15.75h5' },
  ],
  'arrow-up': [
    { circle: [12, 12, 8.75], kind: 'accent' },
    { circle: [12, 12, 8.75] },
    { d: 'M12 16.25v-8.5M8.25 11.25 12 7.5l3.75 3.75' },
  ],
  moon: [
    { d: 'M19.5 14.6A7.9 7.9 0 1 1 9.4 4.5a6.25 6.25 0 0 0 10.1 10.1Z', kind: 'accent' },
    { d: 'M19.5 14.6A7.9 7.9 0 1 1 9.4 4.5a6.25 6.25 0 0 0 10.1 10.1Z' },
  ],
} satisfies Record<string, GlyphPart[]>;

export type IconName = keyof typeof GLYPHS;
