import { Pressable, View, type ViewProps, type ViewStyle } from 'react-native';
import { colors, radius, shadows, spacing, type ShadowKey } from '@/theme';

export interface CardProps extends ViewProps {
  onPress?: () => void;
  padding?: number;
  radiusKey?: keyof typeof radius;
  shadow?: ShadowKey;
  backgroundColor?: string;
  style?: ViewStyle | ViewStyle[];
}

/** White rounded surface with a soft warm shadow. Tappable when onPress given. */
export function Card({
  onPress,
  padding = spacing.lg,
  radiusKey = 'lg',
  shadow = 'card',
  backgroundColor = colors.card,
  style,
  children,
  ...rest
}: CardProps) {
  const base: ViewStyle = {
    backgroundColor,
    borderRadius: radius[radiusKey],
    padding,
  };
  const styles = [shadows[shadow], base, style] as ViewStyle[];

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [...styles, pressed ? { transform: [{ scale: 0.985 }] } : null]}
      >
        {children}
      </Pressable>
    );
  }
  return (
    <View style={styles} {...rest}>
      {children}
    </View>
  );
}
