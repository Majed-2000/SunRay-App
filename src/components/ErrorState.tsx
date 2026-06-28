import { View } from 'react-native';
import { colors, spacing } from '@/theme';
import { Txt } from './Txt';
import { Button } from './Button';

export interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  retryLabel?: string;
}

/** Graceful error state with a retry action (used for mock service failures). */
export function ErrorState({
  title = 'تعذّر تحميل البيانات',
  message = 'حدث خطأ غير متوقع. حاول مرة أخرى.',
  onRetry,
  retryLabel = 'إعادة المحاولة',
}: ErrorStateProps) {
  return (
    <View style={{ alignItems: 'center', paddingVertical: spacing['5xl'], paddingHorizontal: spacing['3xl'] }}>
      <Txt size={48} style={{ opacity: 0.6 }}>
        ⚠️
      </Txt>
      <Txt size={17} weight="extraBold" color={colors.ink} center style={{ marginTop: spacing.md }}>
        {title}
      </Txt>
      <Txt size={13} color={colors.textMuted} center style={{ marginTop: 6, lineHeight: 20 }}>
        {message}
      </Txt>
      {onRetry ? (
        <View style={{ marginTop: spacing.xl }}>
          <Button label={retryLabel} onPress={onRetry} fullWidth={false} size="sm" />
        </View>
      ) : null}
    </View>
  );
}
