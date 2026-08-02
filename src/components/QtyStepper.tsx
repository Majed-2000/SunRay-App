import { Pressable, View } from 'react-native';
import { colors, radius } from '@/theme';
import { toArabicDigits } from '@/utils/numerals';
import { Txt } from './Txt';

export interface QtyStepperProps {
  value: number;
  onInc: () => void;
  onDec: () => void;
  size?: 'sm' | 'md';
  min?: number;
}

export function QtyStepper({ value, onInc, onDec, size = 'md', min = 1 }: QtyStepperProps) {
  const dim = size === 'sm' ? 26 : 30;
  const gap = size === 'sm' ? 12 : 16;
  const atMin = value <= min;

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap,
        backgroundColor: size === 'sm' ? colors.chip : colors.card,
        borderRadius: radius.pill,
        paddingVertical: 6,
        paddingHorizontal: 8,
        borderWidth: size === 'sm' ? 0 : 1,
        borderColor: colors.border,
      }}
    >
      <Round
        dim={dim}
        bg={size === 'sm' ? colors.card : colors.chipGoldStrong}
        onPress={onDec}
        disabled={atMin}
        label="إنقاص الكمية"
      >
        −
      </Round>
      <Txt
        size={size === 'sm' ? 15 : 17}
        weight="black"
        color={colors.ink}
        style={{ minWidth: 16, textAlign: 'center' }}
        accessibilityLabel={`الكمية ${toArabicDigits(value)}`}
      >
        {toArabicDigits(value)}
      </Txt>
      <Round dim={dim} bg={colors.gold} fg={colors.inkDeep} onPress={onInc} label="زيادة الكمية">
        +
      </Round>
    </View>
  );
}

function Round({
  dim,
  bg,
  fg = colors.ink,
  onPress,
  disabled,
  label,
  children,
}: {
  dim: number;
  bg: string;
  fg?: string;
  onPress: () => void;
  disabled?: boolean;
  /** Spoken name. "+" and "−" are glyphs, and read out as nothing useful. */
  label: string;
  children: string;
}) {
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: Boolean(disabled) }}
      // The circle itself is 26–30px. Enough slop to clear the 44px minimum
      // touch target, since these two buttons sit close together and a miss
      // means changing the wrong quantity.
      hitSlop={Math.max(6, Math.ceil((44 - dim) / 2))}
      style={({ pressed }) => ({
        width: dim,
        height: dim,
        borderRadius: radius.full,
        backgroundColor: bg,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: disabled ? 0.4 : pressed ? 0.7 : 1,
      })}
    >
      <Txt size={20} weight="bold" color={fg} style={{ lineHeight: dim }}>
        {children}
      </Txt>
    </Pressable>
  );
}
