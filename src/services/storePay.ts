/**
 * Payment, via Moyasar.
 *
 * ## The client result is a hint. The webhook is the truth.
 *
 * `onPaymentResult` tells us what the card form saw on this device. It is not
 * what the business acts on. The server settles from Moyasar's webhook:
 *
 *     moyasarWebhook → payment.metadata.order_id → settlePayment(…)
 *
 * and `store_payments.js` says why that matters — the webhook guarantees
 * settlement even if the browser redirect is lost. The same is true, and more
 * often, on a phone: the app can be backgrounded, killed, or lose signal in the
 * second between the card being charged and the screen updating.
 *
 * So a successful `onPaymentResult` does not confirm anything. It only means
 * "stop showing the card form and start watching the order". Confirmation comes
 * from the order's own status in RTDB, written by the server.
 *
 * This also means the app needs **no new server code at all**: passing
 * `metadata.order_id` puts it on the exact settlement path the web store uses —
 * same record, same SR- number, same print at the branch, same accounting.
 *
 * ## Money never originates here
 *
 * `amount` is whatever `createStoreOrder` returned, and that came from the
 * catalog on the server. The app never computes a figure to charge; if the
 * order call failed there is nothing to pay and the sheet must not open.
 */
import { onValue, ref, off, type DataSnapshot } from 'firebase/database';
import { db } from './firebase';

/**
 * Moyasar publishable key.
 *
 * Public by design — it identifies the merchant to the card form and authorises
 * nothing. It already ships in the web store's client JavaScript. The secret
 * key that can move money lives only in `functions/.env`.
 *
 * ⚠️ This is a LIVE key. Every payment made against it is a real charge that
 * prints at the branch and enters the accounts.
 */
export const MOYASAR_PUBLISHABLE_KEY = 'pk_live_u4HxZXcumJBYH5d8iSqQLTZtJEGZTcTAKVB8biiE';

/** Terminal states an order can settle into. */
export type SettledStatus = 'paid' | 'failed' | 'cancelled' | 'refunded' | 'review';

export interface SettlementResult {
  status: SettledStatus | 'timeout';
  /** The order as last seen, for the success screen. */
  order?: Record<string, unknown> | null;
}

/** How long to wait for the webhook before telling the customer to check later. */
const SETTLE_TIMEOUT_MS = 90_000;

/**
 * Watch an order until the server settles it.
 *
 * Resolves on the first terminal status, or `timeout`. A timeout is **not** a
 * failure and must never be shown as one: the charge may well have succeeded
 * and the webhook simply be a few seconds behind. The screen should say the
 * payment is being confirmed and point at the order, which will update itself.
 */
export function waitForSettlement(
  orderId: string,
  timeoutMs: number = SETTLE_TIMEOUT_MS,
): Promise<SettlementResult> {
  return new Promise((resolve) => {
    const orderRef = ref(db(), `store/orders/${orderId}`);
    let done = false;

    const finish = (result: SettlementResult) => {
      if (done) return;
      done = true;
      off(orderRef, 'value', handler);
      clearTimeout(timer);
      resolve(result);
    };

    const handler = (snap: DataSnapshot) => {
      const order = snap.val() as { status?: string } | null;
      const status = order?.status;
      if (
        status === 'paid' ||
        status === 'failed' ||
        status === 'cancelled' ||
        status === 'refunded' ||
        status === 'review'
      ) {
        finish({ status, order: order as Record<string, unknown> });
      }
    };

    const timer = setTimeout(() => finish({ status: 'timeout' }), timeoutMs);
    onValue(orderRef, handler);
  });
}

/**
 * Build the description Moyasar shows on the statement and the receipt.
 * The order code makes a charge traceable when a customer queries it later.
 */
export function paymentDescription(code: string): string {
  return `Sun Ray — ${code}`;
}

/**
 * Metadata that ties the charge to the order.
 *
 * `order_id` is not decoration: it is the only thing connecting the payment to
 * the order for `settlePayment`. Without it the webhook logs
 * `store.pay.no_order` and the customer is charged for an order that never
 * confirms.
 */
export function paymentMetadata(orderId: string): Record<string, string> {
  return { order_id: orderId };
}

/** Arabic for a settlement outcome. */
export function describeSettlement(status: SettlementResult['status']): string {
  switch (status) {
    case 'paid':
      return 'تم الدفع بنجاح';
    case 'failed':
      return 'لم تكتمل عملية الدفع';
    case 'cancelled':
      return 'أُلغي الطلب';
    case 'refunded':
      return 'تم استرداد المبلغ';
    case 'review':
      return 'طلبك قيد المراجعة، سنتواصل معك';
    case 'timeout':
      // Deliberately not an error: the charge may have gone through.
      return 'نؤكّد دفعتك الآن — تابع حالة طلبك بعد قليل';
    default:
      return 'تعذّر تأكيد الدفع';
  }
}
