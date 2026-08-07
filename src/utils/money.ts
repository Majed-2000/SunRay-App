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
  /** Fee as quoted by the store. Omitted → 0, never a compiled-in default. */
  deliveryFee?: number;
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

/**
 * Compute the full order breakdown applied in a sensible order.
 *
 * 🔴 VAT is INCLUSIVE. Menu prices come from Foodics as shelf prices and already
 * contain the tax, so it is EXTRACTED from the total for the receipt, never
 * added on top. Adding it would show 11.50 for a 10.00 coffee while the counter
 * charges 10.00 — which is exactly the bug this replaced. The backend computes
 * the same way in `common/money.ts`; the two must not drift apart.
 */
export function calcTotals(input: TotalsInput): OrderTotals {
  const { lines, isDelivery } = input;
  const subtotal = calcSubtotal(lines);

  /**
   * The delivery fee is the SERVER'S number.
   *
   * It used to be a 15 ﷼ literal with a 120 ﷼ free-delivery threshold compiled
   * into the app. Both are values the business changes without shipping a
   * release, and a stale copy quotes the customer a fee that is not what the
   * card is charged. Callers pass what the store told them; absent that we
   * charge nothing rather than invent a figure.
   */
  const deliveryFee = isDelivery ? clampNonNeg(input.deliveryFee ?? 0) : 0;

  const discount = clampNonNeg(input.discount ?? 0);
  const gross = subtotal + deliveryFee - discount;
  // The tax already sitting inside `gross`, shown as a breakdown line.
  const vat = round2(gross - gross / (1 + CONFIG.VAT_RATE));

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

/**
 * Points a spend would earn, at the rate the LEDGER reports.
 *
 * `pointsPerSar` arrives from `myLoyalty`; it is a configurable value, not the
 * 1:1 constant this used to assume. The real award happens when the order
 * settles — this is only an estimate for the screen.
 */
export function pointsEarned(subtotal: number, pointsPerSar: number): number {
  return Math.round(subtotal * (pointsPerSar > 0 ? pointsPerSar : 0));
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
function clampNonNeg(n: number): number {
  return n < 0 ? 0 : n;
}
