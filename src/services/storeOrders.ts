/**
 * Orders, against the live store.
 *
 * The order is created **server-side from the catalog** — the app sends what
 * the customer picked, never what it thinks anything costs. `createStoreOrder`
 * recomputes every line from `menu/products`, ignores any price the client
 * sends, and signs the total. That is the only figure Moyasar is ever asked to
 * charge.
 *
 * ## Fulfilment: two modes, not six
 *
 * The store supports `pickup` (collect at the branch) and `car` (curbside).
 * There is no delivery mode anywhere in `store_payments.js`, and the store's
 * own pages say so outright: "استلام من الفرع أو خدمة السيارة — لا يوجد توصيل".
 * Delivery and dine-in stay behind `STORE_HAS_DELIVERY` in the app; if either
 * ever reached this call it would be silently recorded as a pickup, and nobody
 * would drive anywhere.
 */
import { callFn } from './firebase';
import type { BrewMethod } from '@/types';

/** Fulfilment modes the store actually accepts. */
export type StoreOrderMode = 'pickup' | 'car';

/** Brewing method — affects price, so it is chosen before the price is read. */
export type BrewTemp = BrewMethod;

export interface StoreOrderItem {
  /** Key in `menu/products`. */
  serviceId: string;
  qty: number;
  /** Set only for products priced per method; the server falls back to base. */
  temp?: BrewTemp;
  /** Milk choice — the server applies the surcharge, the app only names it. */
  milk?: string;
  /** Loyalty reward tier. Enters the cart at price zero; the server deducts. */
  rewardId?: string;
  notes?: string;
}

export interface CreateOrderInput {
  items: StoreOrderItem[];
  mode: StoreOrderMode;
  customer?: { name?: string; phone?: string };
  note?: string;
  couponCode?: string;
  /** Curbside only — the car the barista is looking for. */
  plateRaw?: string;
  plateLettersAr?: string;
  plateNumbers?: string;
  carType?: string;
  carColor?: string;
}

export interface CreateOrderResult {
  orderId: string;
  /** Short human code, e.g. SR-0042. For the counter, not for lookup. */
  code: string;
  totalHalalas: number;
  currency: string;
  /**
   * True when the order is already fully covered — by a gift card, a loyalty
   * reward, or a coupon. **Do not open the payment sheet for these.** Charging
   * zero fails, and asking for a card on a free order is alarming.
   */
  free: boolean;
  /** Hosted payment URL, when the server issued one. */
  payUrl?: string | null;
  /**
   * The tracking token — the only public key to this order.
   *
   * The short `code` is a four-digit counter that wraps at 9999, so changing a
   * digit used to open a stranger's order (incident 2026-07-23). Track by this.
   */
  publicToken?: string | null;
  /** Loyalty points spent on this order, and the balance left after. */
  rewardPoints?: number;
  loyaltyBalance?: number | null;
}

/**
 * Create the order. Throws `HttpsError` on every refusal — see
 * `describeOrderError`, which turns each into something a customer can act on.
 */
export async function createStoreOrder(input: CreateOrderInput): Promise<CreateOrderResult> {
  return callFn<CreateOrderResult>('createStoreOrder', input);
}

/**
 * One row in "طلباتي".
 *
 * `myOrders` returns a single merged feed, not just cart orders — `type`
 * distinguishes a store order (`cart`) from catering, a session booking, a
 * support ticket or a gift card. They all belong to the customer and all
 * belong on one screen; splitting them would make the customer reason about
 * which system produced what, which is our concern, not theirs.
 */
export interface MyOrder {
  id: string;
  /** RTDB path — the feed spans several collections. */
  ref: string;
  /** `cart` · `catering` · `session` · `ticket` · `gift` */
  type: string;
  code: string | null;
  status: string | null;
  /** Set once the branch has handed the order over. */
  fulfillment?: string | null;
  totalHalalas: number;
  createdAt: number;
  items?: { name: string; qty: number }[];
  /**
   * Present only while an order is still payable.
   *
   * Without it an unpaid order is a dead end on this screen — the customer can
   * see what they owe and has no way to pay it.
   */
  payLink?: { url: string; expiresAt: number } | null;
  /** What the customer is allowed to see of a refund: amount, date, their own
   *  message and ticket. Never the internal reason or the staff member. */
  refund?: {
    amountHalalas: number;
    at: number | null;
    cancelled: boolean;
    ticketCode: string | null;
  } | null;
  /**
   * Auto-closed after sitting "ready" undelivered.
   *
   * ⚠️ Not proof of delivery — the status itself stays `ready`. It exists so
   * the text can change from "ready and waiting" (two days later) to an
   * invitation to get in touch.
   */
  autoClosed?: boolean;
  /** Catering only. */
  paidHalalas?: number;
  remainderHalalas?: number;
  eventDate?: string | null;
  eventTime?: string | null;
}

export interface MyOrdersResult {
  phone: string | null;
  orders: MyOrder[];
}

/**
 * The signed-in customer's orders.
 *
 * Replaces both the mock list and the separate Foodics history call — one
 * list, one source, already sorted newest first by the server.
 *
 * `phone: null` means the server could not tie this account to a number. It
 * used to be indistinguishable from "no orders yet", and that hid a real fault
 * for a month; treat it as an error state, not an empty one.
 */
export async function fetchMyOrders(): Promise<MyOrdersResult> {
  const res = await callFn<MyOrdersResult>('myOrders');
  return { phone: res?.phone ?? null, orders: res?.orders ?? [] };
}

/** Cancel an unpaid order. Paid orders go through the refund path instead. */
export async function cancelOrder(orderId: string): Promise<boolean> {
  try {
    const res = await callFn<{ ok?: boolean }>('cancelStoreOrderNoRefund', { orderId });
    return res?.ok !== false;
  } catch {
    return false;
  }
}

/**
 * Turn a thrown `HttpsError` into Arabic the customer can act on.
 *
 * These are not developer errors — they are the ordinary ways an order is
 * refused, and each needs a different response from the customer. The store
 * encodes some of them with a payload, e.g.
 * `temporarily_closed:prayer:17:30`, which carries the reopening time; showing
 * a bare "unavailable" would throw that away and leave someone guessing whether
 * to wait five minutes or an hour.
 */
export function describeOrderError(e: unknown): string {
  const raw = (e as { message?: string })?.message ?? '';
  const [key, ...rest] = raw.split(':');

  switch (key) {
    case 'store_closed':
      return 'المتجر مغلق حاليًا';
    case 'temporarily_closed': {
      const [reason, reopen] = rest;
      const why =
        reason === 'prayer' ? 'وقت الصلاة' : reason === 'friday' ? 'صلاة الجمعة' : 'الصيانة';
      return reopen ? `مغلق مؤقتًا (${why}) — نفتح ${reopen}` : `مغلق مؤقتًا (${why})`;
    }
    case 'empty_cart':
      return 'سلّتك فارغة';
    case 'too_many_items':
      return 'عدد الأصناف كبير جدًا';
    case 'service_unavailable':
    case 'inactive':
    case 'not_purchasable':
      return 'أحد الأصناف لم يعد متاحًا — حدّث سلّتك';
    case 'section_closed':
      return 'هذا القسم مغلق الآن';
    case 'breakfast_closed':
      return 'الفطور متاح في أوقات محددة فقط';
    case 'rewards_unpublished':
      return 'المكافآت غير متاحة حاليًا';
    case 'bad_price':
      return 'تعذّر تسعير أحد الأصناف، حاول لاحقًا';
    case 'unauthenticated':
      return 'سجّل دخولك لإتمام الطلب';
    default:
      return 'تعذّر إنشاء الطلب، حاول مرة أخرى';
  }
}
