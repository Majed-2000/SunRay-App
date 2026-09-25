import { Pressable, View } from 'react-native';
import { colors, radius, shadows } from '@/theme';
import { Txt } from './Txt';
import { Icon, type IconName } from './icons/Icon';

export interface IconTileProps {
  icon: IconName;
  label: string;
  /** Tile background behind the icon. Brand cream-gold by default. */
  tint?: string;
  onPress?: () => void;
}

/** Home quick-action tile (طلب مسبق / سيارتي …). */
export function IconTile({ icon, label, tint = colors.chipGold, onPress }: IconTileProps) {
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
        <Icon name={icon} size={24} />
      </View>
      <Txt size={11} weight="extraBold" color={colors.ink} center style={{ marginTop: 8 }}>
        {label}
      </Txt>
    </Pressable>
  );
}
