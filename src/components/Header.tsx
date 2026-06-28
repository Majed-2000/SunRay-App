import { type ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { colors, radius, shadows, spacing } from '@/theme';
import { Txt } from './Txt';

export interface HeaderProps {
  title?: string;
  subtitle?: string;
  /** Show a circular back button. Defaults to router.back when onBack omitted. */
  showBack?: boolean;
  onBack?: () => void;
  right?: ReactNode;
  large?: boolean;
}

export function Header({ title, subtitle, showBack, onBack, right, large }: HeaderProps) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        paddingVertical: spacing.sm,
        minHeight: 48,
      }}
    >
      {showBack ? (
        <Pressable
          onPress={onBack ?? (() => router.back())}
          hitSlop={8}
          style={({ pressed }) => [
            shadows.xs,
            {
              width: 40,
              height: 40,
              borderRadius: radius.full,
              backgroundColor: colors.card,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: pressed ? 0.7 : 1,
            },
          ]}
        >
          {/* RTL back points to the right */}
          <Ionicons name="arrow-forward" size={20} color={colors.ink} />
        </Pressable>
      ) : null}

      <View style={{ flex: 1 }}>
        {title ? (
          <Txt size={large ? 24 : 20} weight="black" color={colors.ink}>
            {title}
          </Txt>
        ) : null}
        {subtitle ? (
          <Txt size={13} color={colors.textMuted} style={{ marginTop: 2 }}>
            {subtitle}
          </Txt>
        ) : null}
      </View>

      {right ?? null}
    </View>
  );
}
