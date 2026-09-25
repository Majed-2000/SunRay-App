import { Pressable, View } from 'react-native';
import { colors, radius, spacing } from '@/theme';
import { Txt } from './Txt';
import { Icon, type IconName } from './icons/Icon';

export interface CategoryPillProps {
  label: string;
  active?: boolean;
  onPress?: () => void;
  /** Use gold (rather than dark ink) for the active state. */
  goldActive?: boolean;
  /** Brand icon before the label. */
  icon?: IconName;
}

export function CategoryPill({ label, active, onPress, goldActive, icon }: CategoryPillProps) {
  const bg = active ? (goldActive ? colors.gold : colors.ink) : colors.card;
  const fg = active ? (goldActive ? colors.inkDeep : colors.white) : colors.ink;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityState={{ selected: Boolean(active) }}
      accessibilityLabel={label}
      // The pill draws at 38 to keep the strip compact; the slop brings the
      // actual target to 44. This row gets tapped more than anything else in
      // the app.
      hitSlop={{ top: 6, bottom: 6 }}
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
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        {icon ? <Icon name={icon} size={17} color={fg} /> : null}
        <Txt
          size={13}
          weight="extraBold"
          color={fg}
          style={{ lineHeight: 20, textAlignVertical: 'center', includeFontPadding: false }}
        >
          {label}
        </Txt>
      </View>
    </Pressable>
  );
}
