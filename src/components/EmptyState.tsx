import { View } from 'react-native';
import { colors, spacing } from '@/theme';
import { Txt } from './Txt';
import { Button } from './Button';

export interface EmptyStateProps {
  emoji?: string;
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({ emoji = '☀', title, subtitle, actionLabel, onAction }: EmptyStateProps) {
  return (
    <View style={{ alignItems: 'center', paddingVertical: spacing['5xl'], paddingHorizontal: spacing['3xl'] }}>
      <Txt size={54} style={{ opacity: 0.5 }}>
        {emoji}
      </Txt>
      <Txt size={17} weight="extraBold" color={colors.ink} center style={{ marginTop: spacing.md }}>
        {title}
      </Txt>
      {subtitle ? (
        <Txt size={13} color={colors.textMuted} center style={{ marginTop: 6, lineHeight: 20 }}>
          {subtitle}
        </Txt>
      ) : null}
      {actionLabel && onAction ? (
        <View style={{ marginTop: spacing.xl }}>
          <Button label={actionLabel} onPress={onAction} fullWidth={false} size="sm" />
        </View>
      ) : null}
    </View>
  );
}
