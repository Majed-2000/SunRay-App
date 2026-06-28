import { useCartStore, couponDiscount } from '@/store/cartStore';
import { useWalletStore } from '@/store/walletStore';
import { useLoyaltyStore } from '@/store/loyaltyStore';
import { calcTotals, type OrderTotals } from '@/utils/money';
import { CONFIG } from '@/constants/config';

export interface CartTotals extends OrderTotals {
  count: number;
  /** Points that would be consumed for the applied points discount. */
  pointsSpent: number;
}

/** Live cart breakdown combining cart, coupon, wallet and points state. */
export function useCartTotals(): CartTotals {
  const lines = useCartStore((s) => s.lines);
  const orderType = useCartStore((s) => s.orderType);
  const coupon = useCartStore((s) => s.coupon);
  const useWallet = useCartStore((s) => s.useWallet);
  const redeemPoints = useCartStore((s) => s.redeemPoints);
  const walletBalance = useWalletStore((s) => s.balance);
  const points = useLoyaltyStore((s) => s.points);

  const discount = couponDiscount(coupon, lines);

  // Pre-compute the gross before wallet/points to bound the points discount.
  const pre = calcTotals({ lines, isDelivery: orderType === 'delivery', discount });
  const grossBeforePerks = pre.subtotal + pre.vat + pre.deliveryFee - pre.discount;

  const maxPointsValue = points * CONFIG.POINTS_REDEEM_RATE;
  const pointsDiscount = redeemPoints
    ? Math.min(maxPointsValue, grossBeforePerks)
    : 0;
  const pointsSpent = redeemPoints
    ? Math.ceil(pointsDiscount / CONFIG.POINTS_REDEEM_RATE)
    : 0;

  const walletApplied = useWallet ? walletBalance : 0;

  const totals = calcTotals({
    lines,
    isDelivery: orderType === 'delivery',
    discount,
    pointsDiscount,
    walletApplied,
  });

  return {
    ...totals,
    count: lines.reduce((a, l) => a + l.qty, 0),
    pointsSpent,
  };
}
