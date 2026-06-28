import { CONFIG } from '@/constants/config';
import type { CartLine } from '@/types';

export interface OrderTotals {
  subtotal: number;
  vat: number;
  deliveryFee: number;
  discount: number;
  walletApplied: number;
  pointsDiscount: number;
  total: number;
}

export interface TotalsInput {
  lines: CartLine[];
  isDelivery: boolean;
  discount?: number; // coupon discount (﷼)
  walletApplied?: number; // wallet balance applied (﷼)
  pointsDiscount?: number; // value of redeemed points (﷼)
}

export function lineTotal(line: CartLine): number {
  return line.unitPrice * line.qty;
}

export function calcSubtotal(lines: CartLine[]): number {
  return lines.reduce((sum, l) => sum + lineTotal(l), 0);
}

/** Compute the full order breakdown applied in a sensible order. */
export function calcTotals(input: TotalsInput): OrderTotals {
  const { lines, isDelivery } = input;
  const subtotal = calcSubtotal(lines);
  const vat = round2(subtotal * CONFIG.VAT_RATE);

  let deliveryFee = 0;
  if (isDelivery) {
    deliveryFee =
      subtotal >= CONFIG.FREE_DELIVERY_THRESHOLD ? 0 : CONFIG.DELIVERY_FEE;
  }

  const discount = clampNonNeg(input.discount ?? 0);
  const gross = subtotal + vat + deliveryFee - discount;

  const pointsDiscount = Math.min(clampNonNeg(input.pointsDiscount ?? 0), gross);
  const afterPoints = gross - pointsDiscount;

  const walletApplied = Math.min(clampNonNeg(input.walletApplied ?? 0), afterPoints);
  const total = round2(Math.max(0, afterPoints - walletApplied));

  return {
    subtotal: round2(subtotal),
    vat,
    deliveryFee,
    discount: round2(discount),
    walletApplied: round2(walletApplied),
    pointsDiscount: round2(pointsDiscount),
    total,
  };
}

export function pointsEarned(subtotal: number): number {
  return Math.round(subtotal * CONFIG.POINTS_PER_RIYAL);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
function clampNonNeg(n: number): number {
  return n < 0 ? 0 : n;
}
