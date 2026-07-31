/**
 * Past order history from Foodics, for a customer identified by phone.
 *
 * This lets someone who has been buying coffee at the counter for months open
 * the app for the first time and immediately see all of it.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔴 WHY THIS IS GATED ON A REAL OTP PROVIDER
 *
 * The business has ~4,058 real customers. This function turns a phone number
 * into that person's full name and complete purchase history.
 *
 * With OTP_PROVIDER=mock, `verifyOtp` ignores the code entirely — any 4 digits
 * authenticate any phone number. So a session's phone proves NOTHING about who
 * is holding the device. Exposing history under those conditions would let
 * anyone type a customer's number and read their name, what they order, how
 * often, and how much they spend. For Saudi residents' personal data that is a
 * PDPL matter, not merely a bug.
 *
 * The guard therefore lives in code rather than in a doc comment. It disappears
 * on its own the moment a real SMS provider is configured.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { env } from '../../config/env';
import { prisma } from '../../database/prisma';
import { foodics } from './foodics.client';

export interface HistoryOrderItem {
  name: string;
  quantity: number;
  totalPrice: number; // halalas
}

export interface HistoryOrder {
  reference: number;
  foodicsOrderId: string;
  businessDate: string | null;
  totalPrice: number; // halalas
  status: number;
  type: number;
  items: HistoryOrderItem[];
}

export interface HistoryResult {
  available: boolean;
  reason?: string;
  matched: boolean;
  customerName?: string;
  totalOrders: number;
  orders: HistoryOrder[];
}

interface FoodicsCustomer {
  id: string;
  name: string;
  phone: string;
  dial_code: string;
  order_count: number;
}

interface FoodicsOrderLine {
  quantity: number;
  returned_quantity?: number;
  total_price: number;
  product?: { name: string; name_localized: string | null } | null;
}

interface FoodicsOrder {
  id: string;
  reference: number;
  business_date: string | null;
  total_price: number;
  status: number;
  type: number;
  products?: FoodicsOrderLine[];
}

const toHalalas = (sar: number): number => Math.round((sar ?? 0) * 100);

/** True when the login code is actually verified by a provider. */
export function otpIsReal(): boolean {
  return env.OTP_PROVIDER !== 'mock';
}

/**
 * Resolve a local phone (`5XXXXXXXX`) to its Foodics customer and return that
 * customer's orders, newest first.
 *
 * The caller MUST pass a phone derived from the authenticated session, never
 * from a request parameter — otherwise this becomes an IDOR that dumps any
 * customer's history on demand.
 */
export async function getFoodicsHistoryForPhone(
  localPhone: string,
  ourCustomerId?: string,
): Promise<HistoryResult> {
  if (!otpIsReal()) {
    return {
      available: false,
      reason:
        'Order history is disabled while OTP_PROVIDER=mock: any code authenticates any phone, so the session cannot prove identity.',
      matched: false,
      totalOrders: 0,
      orders: [],
    };
  }
  if (!foodics.configured) {
    return { available: false, reason: 'FOODICS_TOKEN is not configured', matched: false, totalOrders: 0, orders: [] };
  }

  // Foodics stores the national number without the dial code, in the same shape
  // our validator enforces (/^5\d{8}$/), so no transformation is needed.
  const found = await foodics.get<{ data: FoodicsCustomer[] }>('/customers', {
    filter: { phone: localPhone },
    per_page: 5,
  });
  const customer = (found.data ?? []).find((c) => c.phone === localPhone);
  if (!customer) {
    return { available: true, matched: false, totalOrders: 0, orders: [] };
  }

  // Remember the mapping so later features (loyalty, order injection) don't have
  // to look it up again.
  if (ourCustomerId) {
    await prisma.customer
      .update({ where: { id: ourCustomerId }, data: { foodicsId: customer.id } })
      .catch(() => undefined); // a duplicate mapping must not break the response
  }

  // Filtering by customer_id returns that customer's orders directly, so the
  // reference-cursor dance needed for a full-account scan does not apply here.
  const res = await foodics.get<{ data: FoodicsOrder[]; meta?: { total: number } }>('/orders', {
    filter: { customer_id: customer.id },
    // `include=products` alone omits product_id AND the product name, leaving
    // line items unattributable. `products.product` is required.
    include: ['products.product'],
    sort: '-reference',
    per_page: 50,
  });

  const orders: HistoryOrder[] = (res.data ?? []).map((o) => ({
    reference: o.reference,
    foodicsOrderId: o.id,
    businessDate: o.business_date,
    totalPrice: toHalalas(o.total_price),
    status: o.status,
    type: o.type,
    items: (o.products ?? []).map((l) => ({
      name: l.product?.name_localized || l.product?.name || 'صنف',
      // Returned units are not part of what the customer actually took home.
      quantity: (l.quantity ?? 0) - (l.returned_quantity ?? 0),
      totalPrice: toHalalas(l.total_price),
    })),
  }));

  return {
    available: true,
    matched: true,
    customerName: customer.name,
    totalOrders: res.meta?.total ?? orders.length,
    orders,
  };
}
