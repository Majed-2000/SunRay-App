import { View } from 'react-native';
import { colors, spacing } from '@/theme';
import { formatRiyal } from '@/utils/numerals';
import { Txt } from './Txt';

export interface PriceRowProps {
  label: string;
  /** Amount in ﷼, or a custom string (e.g. "مجانًا"). */
  amount: number | string;
  emphasize?: boolean; // grand total styling
  positive?: boolean; // discounts/credits shown in accent
  muted?: boolean;
}

export function PriceRow({ label, amount, emphasize, positive, muted }: PriceRowProps) {
  const value = typeof amount === 'number' ? formatRiyal(amount) : amount;
  const valueColor = emphasize
    ? colors.terracotta
    : positive
      ? colors.success
      : colors.ink;
  return (
    <View
      style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: emphasize ? 0 : spacing.sm + 2,
      }}
    >
      <Txt
        size={emphasize ? 18 : 14}
        weight={emphasize ? 'black' : 'medium'}
        color={muted ? colors.textMuted : emphasize ? colors.ink : colors.textSecondary}
      >
        {label}
      </Txt>
      <Txt size={emphasize ? 18 : 14} weight={emphasize ? 'black' : 'bold'} color={valueColor}>
        {positive && typeof amount === 'number' ? `− ${value}` : value}
      </Txt>
    </View>
  );
}
