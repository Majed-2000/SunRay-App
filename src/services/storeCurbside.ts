/**
 * Curbside — "خدمة السيارة".
 *
 * The customer orders, drives over, and presses "وصلت". The branch then knows
 * which car to walk out to.
 *
 * ## Arrival is an event, not a flag
 *
 * `arrivals.js` in the store makes the reasoning explicit: flipping a boolean
 * and showing a toast loses the signal entirely if nobody happens to be looking
 * at the dashboard in that second — and a customer who has already paid is
 * sitting outside. So every press is recorded with a count, first/last
 * timestamps, source and a hashed IP, including the presses that get deduped.
 * That log is what someone reads when a customer says "I pressed it ten minutes
 * ago and nobody came."
 *
 * There are two independent duplicate defences and neither replaces the other:
 * a 60-second window collapses repeated *intent* (a double tap, a retried
 * request whose reply was lost), while a print idempotency key collapses
 * repeated *delivery* into one physical slip.
 *
 * ## Two gates, and why a refusal is not a bug
 *
 * The server refuses the press unless ten minutes have passed since the order,
 * and unless the phone is inside the branch radius (300m by default, tunable
 * from `store/config/arrival`). Both exist to stop "I've arrived" being sent
 * from home or from the road. A customer who gets refused needs to know which
 * gate stopped them, or the button just looks broken.
 */
import { callFn } from './firebase';

export interface ArrivalResult {
  ok: boolean;
  /** Metres from the branch, as the server measured it. */
  distanceM?: number;
  reason?: string;
  retryAfterSec?: number;
}

export interface MarkArrivedInput {
  /** Preferred: the random tracking token. */
  token?: string | null;
  /** Fallback for orders issued before tokens existed. */
  code?: string | null;
  orderId?: string | null;
  lat: number;
  lng: number;
  accuracyM?: number;
}

/**
 * Tell the branch the customer is outside.
 *
 * Identified by token first. The short `SR-` code is a four-digit counter that
 * wraps, and marking arrival by code alone once let any signed-in user flag a
 * stranger's order by guessing — anonymous sessions are signed in too. The
 * server now resolves ownership properly and answers `not-found` for anything
 * it will not serve, so a refusal never reveals whether an order exists.
 */
export async function markCarArrived(input: MarkArrivedInput): Promise<ArrivalResult> {
  try {
    const res = await callFn<ArrivalResult>('markCarArrived', input);
    return { ok: res?.ok !== false, distanceM: res?.distanceM };
  } catch (e) {
    const err = e as { message?: string; details?: { retryAfterSec?: number } };
    return {
      ok: false,
      reason: err?.message ?? 'unknown',
      retryAfterSec: err?.details?.retryAfterSec,
    };
  }
}

/**
 * Arabic for each refusal.
 *
 * Every one of these is a state the customer can do something about, and they
 * need different actions — wait, drive closer, or simply try again. A single
 * "couldn't do that" would leave someone sitting in a car guessing.
 */
export function describeArrivalError(reason?: string, retryAfterSec?: number): string {
  const key = String(reason ?? '').split(':')[0];
  switch (key) {
    case 'too_early':
      return 'طلبك ما زال قيد التحضير — الزر يعمل بعد قليل';
    case 'too_far':
      return 'اضغط «وصلت» عند وصولك للفرع';
    case 'location_required':
      return 'نحتاج إذن الموقع لنعرف أنك عند الفرع';
    case 'order_time_unknown':
      return 'تعذّر تحديد وقت الطلب، تواصل مع الفرع';
    case 'rate_limited':
      return retryAfterSec
        ? `حاول بعد ${Math.ceil(retryAfterSec)} ثانية`
        : 'حاول بعد قليل';
    case 'not-found':
      return 'تعذّر العثور على الطلب';
    default:
      return 'تعذّر إبلاغ الفرع، حاول مرة أخرى';
  }
}
