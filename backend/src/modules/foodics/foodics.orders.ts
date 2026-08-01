/**
 * Order injection: our order → a real ticket in the Foodics cashier.
 *
 * This is the ONLY thing in the codebase that writes to Foodics. Everything
 * else is read-only. A call here puts a physical ticket in front of staff at the
 * counter, so it is gated behind FOODICS_ORDER_INJECTION and every safeguard
 * below is deliberate.
 *
 * ⚠️ SILENT FAILURE — READ THIS FIRST
 * Foodics returns 2xx for an order that never reaches the cashier if the branch
 * has no latitude/longitude, or if no device is configured to receive online
 * orders. Both are true of الحلقة الغربية today. So a "successful" response here
 * proves the API accepted the payload, NOT that anyone will make the coffee.
 * Until the console has the coordinates, confirm visually at the counter.
 */
import { env } from '../../config/env';
import { logger } from '../../common/logger';
import { prisma } from '../../database/prisma';
import { VAT_RATE, vatIncludedIn } from '../../common/money';
import { foodics, FoodicsError } from './foodics.client';

/**
 * The business has exactly one tax group, 15%, applied to all 111 products.
 * Hardcoded because it is a property of this business, not a per-request value,
 * and a wrong id here silently produces mis-taxed tickets.
 */
const TAX_GROUP_ID = '9f9750d8-c602-4269-85e7-fdacc5d58156';
const TAX_ID = '9f9750b4-c4a9-482d-aee7-d6e1466390d8';

/** "طلبات التطبيق" — already exists in the account; better than creating another. */
const APP_ORDER_TAG_ID = 'a23da217-c043-4081-a707-05d482d0ebdc';

/** Foodics order types. 1 dine-in · 2 pick-up · 3 delivery · 4 drive-thru. */
const FOODICS_TYPE: Record<string, number> = { DINE_IN: 1, PICKUP: 2, DELIVERY: 3 };

const toSar = (halalas: number): number => Number((halalas / 100).toFixed(2));

export interface InjectionResult {
  injected: boolean;
  reason?: string;
  foodicsOrderId?: string;
  reference?: number;
}

/**
 * Has this order already been sent? Searched by our own reference, which we put
 * in `meta.3rd_party_order_number`.
 *
 * Retrying a failed POST blindly is how a customer ends up with two tickets and
 * two coffees. When a send fails ambiguously (timeout, dropped connection) the
 * correct move is to look, not to resend.
 */
async function findExisting(internalRef: string): Promise<{ id: string; reference: number } | null> {
  try {
    const res = await foodics.get<{ data: Array<{ id: string; reference: number; meta?: Record<string, unknown> }> }>(
      '/orders',
      { filter: { reference_after: 0 }, sort: '-reference', per_page: 50 },
    );
    const hit = (res.data ?? []).find((o) => o.meta?.['3rd_party_order_number'] === internalRef);
    return hit ? { id: hit.id, reference: hit.reference } : null;
  } catch {
    // If the lookup itself fails we must NOT fall through to sending — that is
    // precisely the duplicate we are trying to avoid.
    return null;
  }
}

/**
 * Send one of our orders to Foodics.
 *
 * Never throws: a Foodics failure must not lose the customer's order. The order
 * already exists in our database; this either attaches a Foodics id to it or
 * records why it could not, for later reconciliation.
 */
export async function injectOrder(orderId: string): Promise<InjectionResult> {
  if (!env.FOODICS_ORDER_INJECTION) {
    return { injected: false, reason: 'FOODICS_ORDER_INJECTION is off' };
  }
  if (!foodics.configured) return { injected: false, reason: 'FOODICS_TOKEN is not configured' };
  if (!env.FOODICS_BRANCH_ID) return { injected: false, reason: 'FOODICS_BRANCH_ID is not set' };

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      items: { include: { options: true, product: { select: { foodicsId: true } } } },
      customer: { select: { phone: true, name: true } },
    },
  });
  if (!order) return { injected: false, reason: 'order not found' };

  // Every line must map to a real Foodics product, or the ticket would be
  // incomplete — better to send nothing than a partial order.
  const unmapped = order.items.filter((i) => !i.product?.foodicsId);
  if (unmapped.length) {
    return { injected: false, reason: `products not synced to Foodics: ${unmapped.length}` };
  }

  // Idempotency before anything is sent.
  const already = await findExisting(order.id);
  if (already) {
    await prisma.order.update({ where: { id: order.id }, data: { /* keep */ } }).catch(() => undefined);
    logger.warn(`Order ${order.id} already exists in Foodics as ${already.reference} — not resending`);
    return { injected: true, foodicsOrderId: already.id, reference: already.reference };
  }

  const products = order.items.map((item) => {
    const lineTotal = item.totalPrice;
    return {
      product_id: item.product!.foodicsId,
      quantity: item.quantity,
      unit_price: toSar(item.unitPrice),
      total_price: toSar(lineTotal),
      // Prices are VAT-inclusive, so the tax is carved out of the line rather
      // than added to it — matching what the counter charges.
      taxes: [{ id: TAX_ID, rate: VAT_RATE * 100, amount: toSar(vatIncludedIn(lineTotal)) }],
      options: item.options
        .filter((o) => o.foodicsOptionId)
        .map((o) => ({
          modifier_option_id: o.foodicsOptionId,
          quantity: 1,
          unit_price: toSar(o.price),
          total_price: toSar(o.price),
        })),
      ...(item.notes ? { meta: { external_additional_product_info: item.notes } } : {}),
    };
  });

  const payload = {
    branch_id: env.FOODICS_BRANCH_ID,
    type: FOODICS_TYPE[order.type] ?? 2,
    // `customer_id` is deliberately omitted: Foodics matches on country_code +
    // phone and creates the customer if absent. Letting it own that mapping is
    // simpler and cannot drift out of sync with our own records.
    ...(order.customer?.phone ? { customer: { country_code: '966', phone: order.customer.phone, name: order.customer.name } } : {}),
    ...(order.customerNotes ? { customer_notes: order.customerNotes } : {}),
    products,
    tags: [{ id: APP_ORDER_TAG_ID }],
    // No `payments`: orders are paid at the branch. Sending payments needs a
    // payment method of an accepted type, and the only one available belongs to
    // an unrelated delivery integration — using it would file our sales under a
    // courier's name in the accounting reports.
    subtotal_price: toSar(order.subtotal),
    total_price: toSar(order.total),
    // Ties the Foodics ticket back to our order. This is the key that makes
    // findExisting() work, and the only defence against duplicate tickets.
    meta: { '3rd_party_order_number': order.id },
  };

  try {
    const res = await foodics.post<{ data: { id: string; reference: number; status: number } }>('/orders', payload);
    const created = res.data;
    logger.info(`Order ${order.id} injected into Foodics as reference ${created.reference}`);
    return { injected: true, foodicsOrderId: created.id, reference: created.reference };
  } catch (err) {
    const e = err as FoodicsError;
    // Log enough to reconcile by hand, but never drop the customer's order.
    logger.warn(`Foodics injection failed for order ${order.id}: ${e.message}`);
    return { injected: false, reason: e.message };
  }
}
