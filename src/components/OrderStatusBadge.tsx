import { View } from 'react-native';
import type { OrderStage } from '@/types';
import { colors, radius } from '@/theme';
import { strings } from '@/i18n';
import { Txt } from './Txt';

const STYLE: Record<OrderStage, { bg: string; fg: string }> = {
  pending: { bg: '#f3e8d0', fg: '#8a6a1e' },
  preparing: { bg: '#fbe9c4', fg: '#9c6a12' },
  ready: { bg: '#e7f4ec', fg: colors.success },
  enRoute: { bg: '#f3e0d2', fg: colors.terracotta },
  completed: { bg: '#e7f4ec', fg: colors.success },
  cancelled: { bg: colors.dangerSoft, fg: colors.danger },
};

/** Badge driven by the customer-facing order stage (see orderStage() in the store). */
export function OrderStatusBadge({ stage }: { stage: OrderStage }) {
  const s = STYLE[stage];
  const label = strings().orderStage[stage];
  return (
    <View
      style={{
        backgroundColor: s.bg,
        borderRadius: radius.pill,
        paddingVertical: 5,
        paddingHorizontal: 12,
        alignSelf: 'flex-start',
      }}
    >
      <Txt size={11} weight="extraBold" color={s.fg}>
        {label}
      </Txt>
    </View>
  );
}
