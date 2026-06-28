import { Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, shadows, spacing } from '@/theme';
import { Txt } from './Txt';

export interface ListRowProps {
  icon?: keyof typeof Ionicons.glyphMap;
  emoji?: string;
  label: string;
  sublabel?: string;
  value?: string;
  onPress?: () => void;
  danger?: boolean;
  rightElement?: React.ReactNode;
  showChevron?: boolean;
}

/** Settings / account style row: icon tile + label + chevron. */
export function ListRow({
  icon,
  emoji,
  label,
  sublabel,
  value,
  onPress,
  danger,
  rightElement,
  showChevron = true,
}: ListRowProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        shadows.xs,
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 13,
          backgroundColor: colors.card,
          borderRadius: radius.md,
          padding: spacing.lg,
          opacity: pressed && onPress ? 0.9 : 1,
        },
      ]}
    >
      {icon || emoji ? (
        <View
          style={{
            width: 38,
            height: 38,
            borderRadius: radius.sm,
            backgroundColor: danger ? colors.dangerSoft : colors.chip,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {emoji ? (
            <Txt size={18}>{emoji}</Txt>
          ) : (
            <Ionicons name={icon!} size={18} color={danger ? colors.danger : colors.terracotta} />
          )}
        </View>
      ) : null}

      <View style={{ flex: 1 }}>
        <Txt size={15} weight="bold" color={danger ? colors.danger : colors.ink}>
          {label}
        </Txt>
        {sublabel ? (
          <Txt size={12} color={colors.textFaint} style={{ marginTop: 1 }}>
            {sublabel}
          </Txt>
        ) : null}
      </View>

      {value ? (
        <Txt size={13} weight="bold" color={colors.textMuted}>
          {value}
        </Txt>
      ) : null}
      {rightElement}
      {showChevron && onPress ? (
        <Ionicons name="chevron-back" size={18} color={colors.textGoldSoft} />
      ) : null}
    </Pressable>
  );
}
