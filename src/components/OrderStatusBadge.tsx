import { View } from 'react-native';
import type { OrderStage } from '@/types';
import { colors, radius } from '@/theme';
import { strings } from '@/i18n';
import { Txt } from './Txt';

/**
 * Gold chips carry CHARCOAL text, not gold text.
 *
 * Dark Gold on a gold-tinted chip measures 4.06–4.31:1, under AA for 11px type.
 * Washing the chips out to fix it would have spent the brand's accent on a
 * background; charcoal on gold is 7.19:1 and is exactly how the identity splits
 * the two — gold fills, charcoal reads.
 */
const STYLE: Record<OrderStage, { bg: string; fg: string }> = {
  pending: { bg: colors.chipGoldStrong, fg: colors.ink },
  preparing: { bg: colors.chipGold, fg: colors.ink },
  ready: { bg: colors.successSoft, fg: colors.success },
  enRoute: { bg: colors.chipGold, fg: colors.ink },
  completed: { bg: colors.successSoft, fg: colors.success },
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
