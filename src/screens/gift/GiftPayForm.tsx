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
import { MOYASAR_PUBLISHABLE_KEY } from '@/services/storePay';
import { giftPaymentDescription, giftPaymentMetadata, type GiftPaymentIntent } from '@/services/storeGifts';

export interface GiftPayFormProps {
  giftId: string;
  /** From `createGiftCardPayment` — never computed on the device. */
  intent: GiftPaymentIntent;
  /** What the card form saw on THIS device. Not a confirmation. */
  onResult: (outcome: 'paid' | 'failed') => void;
}

/**
 * Moyasar's card form for a gift.
 *
 * `MoyasarCardForm` is the same form, but it hard-wires `metadata.order_id`:
 * that is what ties a charge to an order, and it is the wrong key for a gift.
 * A gift is settled from `gift_id` + `gift_intent` — the metadata the site's
 * gift page sends — and a gift charge carrying only an `order_id` would be
 * taken from the card and never activate the gift. Everything else is
 * `MoyasarCardForm` line for line, including the rule that a non-response
 * reads as failure. If that component grows a `metadata` prop, this file can
 * go.
 *
 * The site also passes `callback_url` (the `paymentReturn` function). The RN
 * SDK does not accept one — it fixes its own 3-D Secure return inside the app —
 * so a gift paid here settles through Moyasar's webhook alone, exactly as an
 * app order does. The screen confirms by reading the gift back from the server.
 */
export function GiftPayForm({ giftId, intent, onResult }: GiftPayFormProps) {
  const paymentConfig = useMemo(
    () =>
      new PaymentConfig({
        publishableApiKey: MOYASAR_PUBLISHABLE_KEY,
        amount: intent.amountHalalas, // halalas, as the server priced it
        currency: 'SAR',
        description: giftPaymentDescription(intent.code),
        metadata: giftPaymentMetadata(giftId, intent.intentId),
        supportedNetworks: ['mada', 'visa', 'mastercard', 'amex'],
        creditCard: new CreditCardConfig({ saveCard: false, manual: false }),
      }),
    [giftId, intent.amountHalalas, intent.code, intent.intentId],
  );

  return (
    <View style={{ backgroundColor: colors.card, borderRadius: radius.lg, padding: 14 }}>
      <CreditCard
        paymentConfig={paymentConfig}
        onPaymentResult={(result: PaymentResult) => {
          if (result instanceof PaymentResponse) {
            const paid =
              result.status === PaymentStatus.paid ||
              result.status === PaymentStatus.authorized ||
              result.status === PaymentStatus.captured;
            onResult(paid ? 'paid' : 'failed');
            return;
          }
          onResult('failed');
        }}
        style={{ textInputs: { borderWidth: 1.25 } }}
      />
    </View>
  );
}
