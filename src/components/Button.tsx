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

  const inert = Boolean(disabled || loading);

  return (
    <Pressable
      onPress={inert ? undefined : onPress}
      // Also `disabled`, not just a missing handler. Without it the button still
      // ripples and scales under the finger while doing nothing — it reads as
      // broken rather than unavailable — and assistive tech announces it as
      // actionable.
      disabled={inert}
      accessibilityRole="button"
      accessibilityState={{ disabled: inert, busy: Boolean(loading) }}
      accessibilityLabel={trailing ? `${label}، ${trailing}` : label}
      style={({ pressed }) => [
        variant === 'primary' ? shadows.md : undefined,
        container,
        pressed && !inert ? { transform: [{ scale: 0.98 }] } : null,
        style,
      ]}
      // A white ripple is invisible on the light variants — outline, ghost and
      // gold all sit on cream. Tint the ripple against the surface it lands on.
      android_ripple={
        inert ? null : { color: variant === 'primary' ? 'rgba(255,255,255,0.14)' : 'rgba(42,32,24,0.10)' }
      }
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
