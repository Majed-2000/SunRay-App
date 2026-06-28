import { Pressable, View, type ViewStyle } from 'react-native';
import { colors, radius, spacing } from '@/theme';
import { Txt } from './Txt';

export interface OptionChipProps {
  label: string;
  sublabel?: string;
  selected?: boolean;
  onPress?: () => void;
  /** 'fill' = dark when selected; 'gold' = gold when selected. */
  variant?: 'fill' | 'gold';
  block?: boolean; // flex: 1
  radiusKey?: keyof typeof radius;
  style?: ViewStyle;
}

export function OptionChip({
  label,
  sublabel,
  selected,
  onPress,
  variant = 'fill',
  block,
  radiusKey = 'md',
  style,
}: OptionChipProps) {
  const bg = selected ? (variant === 'gold' ? colors.gold : colors.ink) : colors.card;
  const fg = selected ? (variant === 'gold' ? colors.inkDeep : colors.white) : colors.ink;
  const borderColor = selected && variant === 'gold' ? colors.gold : colors.border;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        {
          flex: block ? 1 : undefined,
          backgroundColor: bg,
          borderRadius: radius[radiusKey],
          borderWidth: 1,
          borderColor,
          paddingVertical: 12,
          paddingHorizontal: spacing.lg,
          alignItems: 'center',
          opacity: pressed ? 0.9 : 1,
        },
        style,
      ]}
    >
      <Txt size={13} weight="extraBold" color={fg}>
        {label}
      </Txt>
      {sublabel ? (
        <Txt size={10} color={selected ? fg : colors.textFaint} style={{ marginTop: 2 }}>
          {sublabel}
        </Txt>
      ) : null}
    </Pressable>
  );
}
