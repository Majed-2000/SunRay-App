/**
 * Coupons and gift cards, from the store.
 *
 * The app carried a hand-written `coupons` array and `mockGiftCards`. Both were
 * inventions, and a coupon in particular is not a display concern: the server
 * resolves it inside `createStoreOrder` and its answer is the only one that
 * counts. Anything shown here is a preview so the cart matches the invoice —
 * `store-checkout.js` describes it in exactly those terms.
 */
import { callFn } from './firebase';

/** A coupon the server has accepted for this customer and amount. */
export interface ResolvedCoupon {
  ok: boolean;
  code?: string;
  /** `amount` (fixed riyals off) or `percent`. */
  kind?: 'amount' | 'percent';
  value?: number;
  discountHalalas?: number;
  reason?: string;
}

/**
 * Check a code the customer typed.
 *
 * Preview only. `createStoreOrder` resolves the coupon again at order time
 * with the real cart, so a code that validates here can still be refused there
 * — expired in between, already used, or not applicable to what is in the cart.
 * The checkout must never bank a discount the server has not applied.
 */
export async function validateCoupon(code: string, amountHalalas: number): Promise<ResolvedCoupon> {
  try {
    const res = await callFn<ResolvedCoupon>('validateCoupon', {
      code: String(code ?? '').trim().toUpperCase(),
      scope: 'store',
      amountHalalas,
    });
    return { ...res, ok: res?.ok !== false };
  } catch (e) {
    return { ok: false, reason: (e as { message?: string })?.message ?? 'invalid' };
  }
}

/**
 * A coupon already tied to this customer's phone, needing no code.
 *
 * Worth fetching even though the server would apply it anyway: without it the
 * customer sees the full price at checkout and assumes their discount was lost.
 */
export async function fetchAutoCoupon(amountHalalas: number): Promise<ResolvedCoupon | null> {
  try {
    const res = await callFn<ResolvedCoupon>('myAutoCoupon', { amountHalalas });
    return res && res.ok !== false ? res : null;
  } catch {
    return null;
  }
}

/**
 * Whether this customer has an automatic coupon at all — for the Offers screen.
 *
 * Separate from `fetchAutoCoupon` because that one answers "does it apply to
 * this amount" and folds every failure into null. Asked without a cart, a
 * coupon with a minimum comes back `below_min`: it exists, it just does not
 * apply to zero, and reporting it as "no offers" hid it. A network or server
 * failure is likewise not "no coupon", and the screen needs to offer a retry.
 */
export type AutoCouponLookup =
  | { status: 'found'; coupon: ResolvedCoupon; belowMin: boolean }
  | { status: 'none' }
  | { status: 'error' };

export async function lookupAutoCoupon(): Promise<AutoCouponLookup> {
  try {
    const res = await callFn<ResolvedCoupon>('myAutoCoupon', { amountHalalas: 0 });
    if (res && res.ok !== false) return { status: 'found', coupon: res, belowMin: false };
    if (String(res?.reason ?? '').split(':')[0] === 'below_min') {
      return { status: 'found', coupon: { ...res, ok: false }, belowMin: true };
    }
    return { status: 'none' };
  } catch {
    return { status: 'error' };
  }
}

export interface StoreGiftCard {
  id: string;
  code?: string | null;
  status: string;
  balanceHalalas: number;
  amountHalalas?: number;
  createdAt?: number;
  expiresAt?: number | null;
  recipientName?: string | null;
  recipientPhone?: string | null;
}

/** Gift cards this customer holds or has sent. */
export async function fetchMyGiftCards(): Promise<StoreGiftCard[]> {
  try {
    const res = await callFn<{ cards?: StoreGiftCard[] } | StoreGiftCard[]>('listGiftCards');
    return Array.isArray(res) ? res : (res?.cards ?? []);
  } catch {
    return [];
  }
}

/** One gift card by code — for the "do I have anything left on this?" check. */
export async function fetchGiftCard(code: string): Promise<StoreGiftCard | null> {
  try {
    return await callFn<StoreGiftCard>('getGiftCard', { code: String(code ?? '').trim() });
  } catch {
    return null;
  }
}

/** Arabic for a coupon refusal. */
export function describeCouponError(reason?: string): string {
  const key = String(reason ?? '').split(':')[0];
  switch (key) {
    case 'not_found':
    case 'invalid':
      return 'كود غير صحيح';
    case 'expired':
      return 'انتهت صلاحية الكود';
    case 'used':
    case 'max_uses':
      return 'هذا الكود استُخدم من قبل';
    case 'below_min':
      return 'قيمة الطلب أقل من الحد المطلوب للكود';
    case 'wrong_scope':
      return 'هذا الكود لا ينطبق على طلبات المتجر';
    default:
      return 'تعذّر تطبيق الكود';
  }
}
