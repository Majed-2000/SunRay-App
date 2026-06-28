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
      <Round dim={dim} bg={size === 'sm' ? colors.card : colors.chipGoldStrong} onPress={onDec} disabled={atMin}>
        −
      </Round>
      <Txt size={size === 'sm' ? 15 : 17} weight="black" color={colors.ink} style={{ minWidth: 16, textAlign: 'center' }}>
        {toArabicDigits(value)}
      </Txt>
      <Round dim={dim} bg={colors.gold} fg={colors.inkDeep} onPress={onInc}>
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
  children,
}: {
  dim: number;
  bg: string;
  fg?: string;
  onPress: () => void;
  disabled?: boolean;
  children: string;
}) {
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      hitSlop={6}
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
