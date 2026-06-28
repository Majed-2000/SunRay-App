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
