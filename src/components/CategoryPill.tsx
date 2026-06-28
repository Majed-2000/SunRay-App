import { Pressable } from 'react-native';
import { colors, radius, spacing } from '@/theme';
import { Txt } from './Txt';

export interface CategoryPillProps {
  label: string;
  active?: boolean;
  onPress?: () => void;
  /** Use gold (rather than dark ink) for the active state. */
  goldActive?: boolean;
}

export function CategoryPill({ label, active, onPress, goldActive }: CategoryPillProps) {
  const bg = active ? (goldActive ? colors.gold : colors.ink) : colors.card;
  const fg = active ? (goldActive ? colors.inkDeep : colors.white) : colors.ink;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 38,
        paddingHorizontal: spacing.lg,
        borderRadius: radius.pill,
        backgroundColor: bg,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: pressed ? 0.85 : 1,
      })}
    >
      {/* Explicit lineHeight + vertical centering prevents Arabic glyphs being
          clipped at the bottom of the pill. */}
      <Txt
        size={13}
        weight="extraBold"
        color={fg}
        style={{ lineHeight: 20, textAlignVertical: 'center', includeFontPadding: false }}
      >
        {label}
      </Txt>
    </Pressable>
  );
}
