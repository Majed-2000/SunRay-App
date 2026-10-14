import { useCartStore, couponDiscount } from '@/store/cartStore';
import { useWalletStore } from '@/store/walletStore';
import { calcTotals, type OrderTotals } from '@/utils/money';

export interface CartTotals extends OrderTotals {
  count: number;
}

/**
 * Live cart breakdown.
 *
 * ## Points do not become a discount here
 *
 * This used to convert the customer's balance into riyals at a made-up rate
 * (10 points = 1 ﷼) and subtract it from the total. The live programme has no
 * such conversion. A reward is claimed by putting the rewarded product in the
 * cart **at price zero**, and `createStoreOrder` performs the points deduction
 * as it writes the order.
 *
 * That is not an implementation detail we could route around: the server
 * recomputes every total from the catalog before charging. A discount invented
 * on the device would not survive settlement — the customer would be shown one
 * figure and charged another.
 *
 * The totals below stay advisory in the same way: the server's number is the
 * one that is charged.
 */
export function useCartTotals(): CartTotals {
  const lines = useCartStore((s) => s.lines);
  const orderType = useCartStore((s) => s.orderType);
  const coupon = useCartStore((s) => s.coupon);
  const useWallet = useCartStore((s) => s.useWallet);
  const walletBalance = useWalletStore((s) => s.balance);

  const discount = couponDiscount(coupon, lines);
  const walletApplied = useWallet ? walletBalance : 0;

  const totals = calcTotals({
    lines,
    isDelivery: orderType === 'delivery',
    discount,
    walletApplied,
  });

  return {
    ...totals,
    count: lines.reduce((a, l) => a + l.qty, 0),
  };
}
