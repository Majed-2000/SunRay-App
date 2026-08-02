/**
 * Orders service interface. The app builds a CheckoutPayload and POSTs it to our
 * backend; the BACKEND validates, recalculates prices/taxes, builds the real
 * Foodics order, injects it (order comes back Pending/source=API), and returns
 * our Order. The app never calls Foodics or submits real orders directly.
 *
 * Real order submission is intentionally NOT wired here — the MVP uses the mock
 * `useOrderStore.place()`. These functions are the future backend contract.
 */
import { request } from './api';
import { toSar } from './dto';
import { toFoodicsOrderType } from './foodics';
import type { CartItem, CheckoutPayload, CheckoutTotals } from './foodics.types';
import type { CartLine, Order, OrderType, PaymentMethod } from '@/types';

/** Map an app cart line → a backend-safe CartItem (prices are advisory only). */
export function toCartItem(line: CartLine): CartItem {
  return {
    productId: line.productId,
    quantity: line.qty,
    modifierOptionIds: [line.sizeId, ...line.addOnIds].filter(Boolean) as string[],
    unitPrice: line.unitPrice,
    notes: line.notes,
  };
}

export interface BuildCheckoutArgs {
  internalRef: string;
  type: OrderType;
  branchId: string;
  customerPhone: string;
  customerAddressId?: string;
  notes?: string;
  lines: CartLine[];
  couponCode?: string;
  payment: { method: PaymentMethod; useWallet: boolean; redeemPoints: boolean };
  totals: CheckoutTotals;
}

/** Build the body for `POST /api/orders` (pickup → type 2, delivery → type 3). */
export function buildCheckoutPayload(args: BuildCheckoutArgs): CheckoutPayload {
  return {
    internalRef: args.internalRef,
    type: toFoodicsOrderType(args.type),
    branchId: args.branchId,
    customerPhone: args.customerPhone,
    customerAddressId: args.type === 'delivery' ? args.customerAddressId : undefined,
    notes: args.notes,
    items: args.lines.map(toCartItem),
    couponCode: args.couponCode,
    payment: args.payment,
    totals: args.totals,
  };
}

/** POST /api/orders — submit an order through the backend → Foodics. */
export async function submitOrder(payload: CheckoutPayload): Promise<Order> {
  return request<Order>('/api/orders', { method: 'POST', body: payload });
}

/** GET /api/orders — the customer's orders. */
export async function listOrders(): Promise<Order[]> {
  return request<Order[]>('/api/orders');
}

/** GET /api/orders/:id — a single order (status reflects Foodics in real time). */
export async function getOrder(id: string): Promise<Order> {
  return request<Order>(`/api/orders/${id}`);
}

// ── Past orders from Foodics ──────────────────────────────────────────────────

export interface PastOrderItem {
  name: string;
  quantity: number;
  /**
   * SAR, not halalas.
   *
   * The backend speaks halalas everywhere; this app's screens format riyals
   * directly (`formatRiyal` multiplies by 100 only to round, never to convert).
   * The two conventions meet here, and getting it wrong showed a 24.00 SAR cake
   * as "2400 ﷼" in the orders screen. Converted once, at the boundary.
   */
  totalPrice: number;
}

export interface PastOrder {
  reference: number;
  foodicsOrderId: string;
  businessDate: string | null;
  /** SAR — see PastOrderItem.totalPrice. */
  totalPrice: number;
  status: number; // Foodics order status (4 = Closed)
  type: number; // Foodics order type (2 = Pick Up, 3 = Delivery)
  items: PastOrderItem[];
}

export interface PastOrdersResult {
  /** False when the backend refuses to serve history — see `reason`. */
  available: boolean;
  reason?: string;
  /** True when this phone exists in Foodics. False simply means "no history". */
  matched: boolean;
  customerName?: string;
  totalOrders: number;
  orders: PastOrder[];
}

/**
 * Orders this customer placed at the counter before the app existed.
 *
 * The backend derives the phone from the session token, so there is nothing to
 * pass. It returns `available: false` while OTP is still mock — the caller
 * should treat that as "no history yet", not as an error worth showing.
 */
export async function fetchPastOrders(): Promise<PastOrdersResult> {
  const res = await request<PastOrdersResult>('/api/orders/history');

  // halalas → SAR, once, here, using the shared converter in dto.ts.
  return {
    ...res,
    orders: (res.orders ?? []).map((o) => ({
      ...o,
      totalPrice: toSar(o.totalPrice),
      items: o.items.map((i) => ({ ...i, totalPrice: toSar(i.totalPrice) })),
    })),
  };
}
