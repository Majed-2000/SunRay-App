/**
 * Orders service.
 *
 * KEY IDEA (server-authoritative pricing): the app sends product ids + chosen
 * options + quantity. We look up the REAL prices in our database and compute the
 * totals here. We never trust a price sent by the client. (This is also how the
 * future Foodics order injection will work.)
 *
 * Orders are also injected into Foodics when FOODICS_ORDER_INJECTION is on, so
 * they appear as a ticket in the cashier. Payment is still taken at the branch.
 */
import type { Order, OrderItem } from '@prisma/client';
import { prisma } from '../../database/prisma';
import { BadRequest, NotFound } from '../../common/errors';
import { DELIVERY_FEE, vatIncludedIn } from '../../common/money';
import type { CreateOrderInput, UpdateStatusInput } from './orders.schemas';
import { getFoodicsHistoryForPhone } from '../foodics/foodics.history';
import { injectOrder } from '../foodics/foodics.orders';
import { logger } from '../../common/logger';

type OrderWithItems = Order & { items: (OrderItem & { options?: { nameAr: string; price: number }[] })[] };

function toOrderDTO(o: OrderWithItems) {
  return {
    id: o.id,
    customerId: o.customerId ?? undefined,
    branchId: o.branchId ?? undefined,
    type: o.type,
    status: o.status,
    subtotal: o.subtotal,
    vat: o.vat,
    deliveryFee: o.deliveryFee,
    discount: o.discount,
    total: o.total,
    customerNotes: o.customerNotes ?? undefined,
    scheduledAt: o.scheduledAt ? o.scheduledAt.getTime() : undefined,
    createdAt: o.createdAt.getTime(),
    items: o.items.map((i) => ({
      id: i.id,
      productId: i.productId,
      productName: i.productName,
      quantity: i.quantity,
      unitPrice: i.unitPrice,
      totalPrice: i.totalPrice,
      notes: i.notes ?? undefined,
      // Chosen size / milk / extras, so the app can show what was ordered
      // without re-resolving option ids that may no longer exist.
      options: (i.options ?? []).map((o) => ({ nameAr: o.nameAr, price: o.price })),
    })),
  };
}

export async function createOrder(input: CreateOrderInput, customerId: string) {
  // 1) Load the real products (with their modifier options) from the DB.
  const productIds = [...new Set(input.items.map((i) => i.productId))];
  const products = await prisma.product.findMany({
    where: { id: { in: productIds } },
    include: { modifiers: { include: { options: true } } },
  });
  const byId = new Map(products.map((p) => [p.id, p]));

  // 2) Build order lines with prices computed from the DB.
  const lines = input.items.map((item) => {
    const product = byId.get(item.productId);
    if (!product) throw BadRequest(`المنتج غير موجود: ${item.productId}`);
    if (!product.isAvailable) throw BadRequest(`المنتج غير متوفر: ${product.nameAr}`);

    // Only allow options that actually belong to this product.
    const validOptions = new Map(
      product.modifiers.flatMap((m) => m.options.map((o) => [o.id, o])),
    );
    let unitPrice = product.price;
    // Snapshot the chosen options: the invoice must keep saying what was bought
    // and at what price even after the menu changes in the Foodics console.
    const chosenOptions = item.modifierOptionIds.map((optionId) => {
      const option = validOptions.get(optionId);
      if (!option) throw BadRequest(`خيار غير صالح لهذا المنتج: ${optionId}`);
      unitPrice += option.price;
      return {
        modifierOptionId: option.id,
        foodicsOptionId: option.foodicsId,
        nameAr: option.nameAr,
        price: option.price,
      };
    });

    const totalPrice = unitPrice * item.quantity;
    return {
      productId: product.id,
      productName: product.nameAr,
      quantity: item.quantity,
      unitPrice,
      totalPrice,
      notes: item.notes,
      options: { create: chosenOptions },
    };
  });

  // 3) Totals (all in halalas).
  //
  // 🔴 VAT is INCLUSIVE: menu prices come from Foodics as shelf prices and
  // already contain the tax. The total is therefore what the lines add up to —
  // adding VAT on top would charge 11.50 for a 10.00 coffee while the counter
  // charges 10.00. `vat` is the portion sitting inside that total, reported for
  // the receipt breakdown and for the taxes[] Foodics wants per line.
  const subtotal = lines.reduce((sum, l) => sum + l.totalPrice, 0);
  const deliveryFee = input.type === 'DELIVERY' ? DELIVERY_FEE : 0;
  // Discount must be authorized server-side (coupon/points). Until that exists we
  // never apply a client-supplied discount — it's forced to 0.
  const discount = 0;
  const total = Math.max(0, subtotal + deliveryFee - discount);
  const vat = vatIncludedIn(total);

  // 4) Save order + items together. The owner is the authenticated customer.
  const order = await prisma.order.create({
    data: {
      customerId,
      branchId: input.branchId,
      type: input.type,
      status: 'PENDING',
      subtotal,
      vat,
      deliveryFee,
      discount,
      total,
      customerNotes: input.customerNotes,
      scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : undefined,
      items: { create: lines },
    },
    include: { items: { include: { options: true } } },
  });

  // 5) Simplified Path-A loyalty: each ordered item adds a "cup".
  const cups = lines.reduce((sum, l) => sum + l.quantity, 0);
  await prisma.loyaltyCounter.upsert({
    where: { customerId },
    create: { customerId, cupCount: cups, goal: 6 },
    update: { cupCount: { increment: cups } },
  });

  // 6) Send it to the cashier. No-op unless FOODICS_ORDER_INJECTION is on.
  //
  // Awaited rather than fired-and-forgotten: the customer is looking at a
  // spinner, and an order that silently failed to reach the counter is worse
  // than a slow confirmation. injectOrder never throws — a Foodics outage must
  // not lose an order we have already accepted and stored.
  const injection = await injectOrder(order.id);
  if (!injection.injected && injection.reason !== 'FOODICS_ORDER_INJECTION is off') {
    logger.warn(`Order ${order.id} not sent to Foodics: ${injection.reason}`);
  }

  return { ...toOrderDTO(order), foodicsOrderId: injection.foodicsOrderId ?? null };
}

export async function listOrders(customerId: string) {
  const orders = await prisma.order.findMany({
    where: { customerId },
    include: { items: { include: { options: true } } },
    orderBy: { createdAt: 'desc' },
  });
  return orders.map(toOrderDTO);
}

export async function getOrderById(id: string, requesterId: string) {
  const order = await prisma.order.findUnique({ where: { id }, include: { items: { include: { options: true } } } });
  // 404 (not 403) when it isn't the caller's order, so we don't reveal that an
  // order with this id exists for someone else.
  if (!order || order.customerId !== requesterId) throw NotFound('الطلب غير موجود');
  return toOrderDTO(order);
}

export async function updateStatus(id: string, input: UpdateStatusInput) {
  const existing = await prisma.order.findUnique({ where: { id }, select: { id: true } });
  if (!existing) throw NotFound('الطلب غير موجود');
  const order = await prisma.order.update({
    where: { id },
    data: { status: input.status },
    include: { items: { include: { options: true } } },
  });
  return toOrderDTO(order);
}

/**
 * Past orders from Foodics for the authenticated customer.
 *
 * The phone is looked up from OUR database using the customer id carried by the
 * session token, so a caller can only ever see their own history. See
 * foodics.history.ts for why this is additionally gated on a real OTP provider.
 */
export async function getFoodicsHistory(customerId: string) {
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    select: { id: true, phone: true },
  });
  if (!customer) throw NotFound('العميل غير موجود');

  return getFoodicsHistoryForPhone(customer.phone, customer.id);
}
