import { useMemo } from 'react';
import { View } from 'react-native';
import {
  CreditCard,
  CreditCardConfig,
  PaymentConfig,
  PaymentResponse,
  PaymentStatus,
  type PaymentResult,
} from 'react-native-moyasar-sdk';
import { colors, radius } from '@/theme';
import {
  MOYASAR_PUBLISHABLE_KEY,
  paymentDescription,
  paymentMetadata,
} from '@/services/storePay';

export interface MoyasarCardFormProps {
  /** From `createStoreOrder` — never computed on the device. */
  orderId: string;
  code: string;
  totalHalalas: number;
  /** Fires when the card form reaches a terminal state on THIS device. */
  onResult: (outcome: 'paid' | 'failed', raw?: PaymentResult) => void;
}

/**
 * Moyasar's card form, configured from a server-created order.
 *
 * ## Two things this component deliberately does not do
 *
 * It does not compute the amount. `totalHalalas` comes from
 * `createStoreOrder`, which recomputed it from the catalog and signed it. A
 * figure assembled on the device would be one the server refuses at settlement.
 *
 * It does not decide that the order is paid. `onResult` reports only what the
 * card form saw here; the caller must then watch the order until the server's
 * webhook settles it. On a phone the gap between those two things is real — the
 * app can be backgrounded or lose signal in the moment after the charge — and
 * `store_payments.js` is explicit that the webhook is what guarantees
 * settlement.
 *
 * `metadata.order_id` is the whole connection between this charge and the
 * order. Without it the webhook logs `store.pay.no_order` and the customer is
 * charged for something that never confirms.
 */
export function MoyasarCardForm({ orderId, code, totalHalalas, onResult }: MoyasarCardFormProps) {
  const paymentConfig = useMemo(
    () =>
      new PaymentConfig({
        publishableApiKey: MOYASAR_PUBLISHABLE_KEY,
        amount: totalHalalas, // halalas — the unit the whole system speaks
        currency: 'SAR',
        description: paymentDescription(code),
        metadata: paymentMetadata(orderId),
        creditCard: new CreditCardConfig({ saveCard: false, manual: false }),
      }),
    [orderId, code, totalHalalas],
  );

  return (
    <View style={{ backgroundColor: colors.card, borderRadius: radius.lg, padding: 14 }}>
      <CreditCard
        paymentConfig={paymentConfig}
        onPaymentResult={(result: PaymentResult) => {
          /**
           * Only a PaymentResponse carries a status; a MoyasarError or a
           * TokenResponse does not. Treating "not a response" as failure is the
           * safe reading — we would rather send the customer to watch the order
           * than tell them a charge succeeded on this evidence.
           */
          if (result instanceof PaymentResponse) {
            const paid =
              result.status === PaymentStatus.paid ||
              result.status === PaymentStatus.authorized ||
              result.status === PaymentStatus.captured;
            onResult(paid ? 'paid' : 'failed', result);
            return;
          }
          onResult('failed', result);
        }}
        style={{ textInputs: { borderWidth: 1.25 } }}
      />
    </View>
  );
}
