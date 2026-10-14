import type { CreateOrderResult } from '@/services/storeOrders';

/** How long an unpaid order is resumed rather than replaced. */
export const RESUME_MS = 10 * 60 * 1000;

export interface InflightCheckoutRecord {
  order: CreateOrderResult;
  /** Signature of the cart it was created from; a changed cart is a new order. */
  cartKey: string;
  at: number;
  /** Customer it was created for; never resumed for someone else. */
  uid?: string | null;
}

/** True when this in-flight order is still the one the same cart should pay for. */
export function isResumable(
  inflight: InflightCheckoutRecord | null | undefined,
  cartKey: string,
  uid: string | null,
  now: number = Date.now(),
): inflight is InflightCheckoutRecord {
  if (!inflight || inflight.cartKey !== cartKey) return false;
  if (now - inflight.at > RESUME_MS) return false;
  if (inflight.uid && uid && inflight.uid !== uid) return false;
  return true;
}

/**
 * What to do with a resumed order given the status the server holds for it.
 *  - `done`  it was paid (or is under review): do not charge again.
 *  - `dead`  cancelled or refunded: start over with a new order.
 *  - `pay`   still collectable: show the card form.
 */
export type ResumeDecision = 'done' | 'dead' | 'pay';

export function resumeDecision(status: string | null | undefined): ResumeDecision {
  switch (status) {
    case 'paid':
    case 'review':
      return 'done';
    case 'cancelled':
    case 'refunded':
      return 'dead';
    default:
      return 'pay';
  }
}
