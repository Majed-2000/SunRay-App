import { memo } from 'react';
import Svg, { Circle, Path } from 'react-native-svg';
import { colors } from '@/theme';
import { GLYPHS, type GlyphPart, type IconName } from './glyphs';

export type { IconName };

export interface IconProps {
  name: IconName;
  size?: number;
  /** Outline colour. Charcoal by default; white on dark surfaces. */
  color?: string;
  /** The gold fill. `null` draws the outline alone (disabled, faint states). */
  accent?: string | null;
}

/**
 * The Sun Ray icon — see `glyphs.ts` for the drawing rules.
 *
 * This replaced emoji across the app. Emoji render differently on every
 * device (Samsung, Google and Apple each draw their own ☕), carry colours
 * the brand does not have, and cannot be tinted for a dark surface or a
 * disabled state. These are drawn once, in the brand's own line and gold.
 */
export const Icon = memo(function Icon({ name, size = 24, color = colors.ink, accent = colors.gold }: IconProps) {
  const parts: GlyphPart[] = GLYPHS[name];
  const accents = accent ? parts.filter((p) => p.kind === 'accent') : [];
  const outlines = parts.filter((p) => !p.kind);
  const inks = parts.filter((p) => p.kind === 'ink');

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {accents.map((p, i) => shape(p, `a${i}`, { fill: accent as string }))}
      {outlines.map((p, i) =>
        shape(p, `o${i}`, {
          fill: 'none',
          stroke: color,
          strokeWidth: p.thin ? 1.1 : 1.75,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
        }),
      )}
      {inks.map((p, i) => shape(p, `i${i}`, { fill: color }))}
    </Svg>
  );
});

function shape(p: GlyphPart, key: string, props: Record<string, unknown>) {
  if (p.circle) {
    const [cx, cy, r] = p.circle;
    return <Circle key={key} cx={cx} cy={cy} r={r} {...props} />;
  }
  return <Path key={key} d={p.d} {...props} />;
}
