import { Pressable, View } from 'react-native';
import { colors, radius, shadows } from '@/theme';
import { Txt } from './Txt';

export interface IconTileProps {
  emoji: string;
  label: string;
  tint: string;
  onPress?: () => void;
}

/** Home quick-action tile (طلب مسبق / توصيل …). */
export function IconTile({ emoji, label, tint, onPress }: IconTileProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        shadows.sm,
        {
          flex: 1,
          backgroundColor: colors.card,
          borderRadius: radius.lg,
          paddingVertical: 15,
          paddingHorizontal: 4,
          alignItems: 'center',
          opacity: pressed ? 0.92 : 1,
        },
      ]}
    >
      <View
        style={{
          width: 38,
          height: 38,
          borderRadius: radius.md,
          backgroundColor: tint,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Txt size={19}>{emoji}</Txt>
      </View>
      <Txt size={11} weight="extraBold" color={colors.ink} center style={{ marginTop: 8 }}>
        {label}
      </Txt>
    </Pressable>
  );
}
