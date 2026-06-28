import { Pressable, View } from 'react-native';
import { colors, spacing } from '@/theme';
import { Txt } from './Txt';

export interface SectionHeaderProps {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
  subtitle?: string;
}

export function SectionHeader({ title, actionLabel, onAction, subtitle }: SectionHeaderProps) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'baseline',
        justifyContent: 'space-between',
        marginBottom: spacing.md,
      }}
    >
      <Txt size={19} weight="black" color={colors.ink}>
        {title}
      </Txt>
      {actionLabel ? (
        <Pressable onPress={onAction} hitSlop={8}>
          <Txt size={13} weight="extraBold" color={colors.terracotta}>
            {actionLabel} ←
          </Txt>
        </Pressable>
      ) : subtitle ? (
        <Txt size={12} color={colors.textFaint}>
          {subtitle}
        </Txt>
      ) : null}
    </View>
  );
}
