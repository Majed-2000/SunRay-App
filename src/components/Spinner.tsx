import { ActivityIndicator, View } from 'react-native';
import { colors, spacing } from '@/theme';
import { Txt } from './Txt';

export interface SpinnerProps {
  label?: string;
  /** Fill the available space and center (for full-screen loading). */
  fill?: boolean;
}

/** Branded loading indicator. */
export function Spinner({ label, fill = true }: SpinnerProps) {
  return (
    <View
      style={{
        flex: fill ? 1 : undefined,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: fill ? spacing['5xl'] : spacing.xl,
        gap: spacing.md,
      }}
    >
      <ActivityIndicator size="large" color={colors.gold} />
      {label ? (
        <Txt size={13} color={colors.textMuted}>
          {label}
        </Txt>
      ) : null}
    </View>
  );
}
