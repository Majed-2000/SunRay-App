import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { WalletTransaction } from '@/types';
import { colors, radius } from '@/theme';
import { formatRiyal } from '@/utils/numerals';
import { relativeDayAr } from '@/utils/date';
import { Txt } from './Txt';

const META: Record<WalletTransaction['type'], { icon: keyof typeof Ionicons.glyphMap; tint: string }> = {
  topup: { icon: 'arrow-down', tint: colors.success },
  payment: { icon: 'cart', tint: colors.terracotta },
  refund: { icon: 'arrow-undo', tint: colors.success },
  giftPurchase: { icon: 'gift', tint: colors.terracotta },
  reward: { icon: 'star', tint: colors.gold },
};

export function TransactionRow({ tx }: { tx: WalletTransaction }) {
  const meta = META[tx.type];
  const credit = tx.amount >= 0;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 }}>
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: radius.sm,
          backgroundColor: colors.chip,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Ionicons name={meta.icon} size={18} color={meta.tint} />
      </View>
      <View style={{ flex: 1 }}>
        <Txt size={14} weight="extraBold" color={colors.ink}>
          {tx.titleAr}
        </Txt>
        <Txt size={11} color={colors.textFaint}>
          {relativeDayAr(tx.createdAt)}
        </Txt>
      </View>
      <Txt size={15} weight="black" color={credit ? colors.success : colors.ink}>
        {credit ? '+' : '−'}
        {formatRiyal(Math.abs(tx.amount))}
      </Txt>
    </View>
  );
}
