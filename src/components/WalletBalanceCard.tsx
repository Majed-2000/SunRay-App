import { Image, Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, shadows, spacing } from '@/theme';
import { formatRiyal } from '@/utils/numerals';
import { LOGO } from '@/assets';
import { Txt } from './Txt';

export interface WalletBalanceCardProps {
  balance: number;
  onTopup?: () => void;
}

export function WalletBalanceCard({ balance, onTopup }: WalletBalanceCardProps) {
  return (
    <View
      style={[
        shadows.lg,
        {
          backgroundColor: colors.ink,
          borderRadius: radius['2xl'],
          padding: 22,
          overflow: 'hidden',
        },
      ]}
    >
      <Image
        source={LOGO}
        style={{ position: 'absolute', left: -20, bottom: -24, width: 104, height: 104, opacity: 0.12 }}
      />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Ionicons name="wallet-outline" size={16} color={colors.goldText} />
        <Txt size={12} weight="bold" color={colors.goldText} latin tracking={1}>
          WALLET
        </Txt>
      </View>
      <Txt size={11} color={colors.textOnDarkMuted} style={{ marginTop: 10 }}>
        الرصيد الحالي
      </Txt>
      <Txt size={40} weight="black" color={colors.white} style={{ lineHeight: 46, marginTop: 2 }}>
        {formatRiyal(balance)}
      </Txt>

      {onTopup ? (
        <Pressable
          onPress={onTopup}
          style={({ pressed }) => ({
            marginTop: spacing.lg,
            backgroundColor: colors.gold,
            borderRadius: radius.md,
            paddingVertical: 12,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            opacity: pressed ? 0.85 : 1,
          })}
        >
          <Ionicons name="add-circle" size={18} color={colors.inkDeep} />
          <Txt size={15} weight="extraBold" color={colors.inkDeep}>
            شحن المحفظة
          </Txt>
        </Pressable>
      ) : null}
    </View>
  );
}
