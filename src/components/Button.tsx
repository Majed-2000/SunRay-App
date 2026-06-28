import { ActivityIndicator, Pressable, StyleSheet, View, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, gradients, radius, shadows, spacing } from '@/theme';
import { Txt } from './Txt';

type Variant = 'primary' | 'gold' | 'outline' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

export interface ButtonProps {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  size?: Size;
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  /** Right-aligned trailing label (e.g. a price), shown in accent color. */
  trailing?: string;
  iconLeft?: React.ReactNode;
  style?: ViewStyle;
}

const HEIGHTS: Record<Size, number> = { sm: 44, md: 52, lg: 56 };
const FONT: Record<Size, number> = { sm: 14, md: 16, lg: 16 };

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled,
  loading,
  fullWidth = true,
  trailing,
  iconLeft,
  style,
}: ButtonProps) {
  const isGold = variant === 'gold';
  const fg =
    variant === 'primary' || variant === 'danger'
      ? colors.white
      : isGold
        ? colors.inkDeep
        : colors.ink;
  const trailingColor = variant === 'primary' ? colors.goldText : fg;

  const container: ViewStyle = {
    height: HEIGHTS[size],
    borderRadius: radius.lg,
    paddingHorizontal: spacing.xl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: trailing ? 'space-between' : 'center',
    width: fullWidth ? '100%' : undefined,
    opacity: disabled ? 0.5 : 1,
    backgroundColor:
      variant === 'primary'
        ? colors.ink
        : variant === 'danger'
          ? colors.dangerSoft
          : variant === 'outline'
            ? colors.transparent
            : variant === 'ghost'
              ? colors.transparent
              : colors.transparent,
    borderWidth: variant === 'outline' ? 1.5 : 0,
    borderColor: colors.border,
  };

  const content = (
    <>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        {loading ? (
          <ActivityIndicator color={fg} />
        ) : (
          <>
            {iconLeft}
            <Txt size={FONT[size]} weight="extraBold" color={variant === 'danger' ? colors.danger : fg}>
              {label}
            </Txt>
          </>
        )}
      </View>
      {trailing ? (
        <Txt size={FONT[size]} weight="black" color={trailingColor}>
          {trailing}
        </Txt>
      ) : null}
    </>
  );

  return (
    <Pressable
      onPress={disabled || loading ? undefined : onPress}
      style={({ pressed }) => [
        variant === 'primary' ? shadows.md : undefined,
        container,
        pressed && !disabled ? { transform: [{ scale: 0.98 }] } : null,
        style,
      ]}
      android_ripple={{ color: 'rgba(255,255,255,0.12)' }}
    >
      {isGold ? (
        <LinearGradient
          colors={gradients.gold}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[StyleSheet.absoluteFill, { borderRadius: radius.lg }]}
        />
      ) : null}
      {content}
    </Pressable>
  );
}
