/**
 * Orders service.
 *
 * KEY IDEA (server-authoritative pricing): the app sends product ids + chosen
 * options + quantity. We look up the REAL prices in our database and compute the
 * totals here. We never trust a price sent by the client. (This is also how the
 * future Foodics order injection will work.)
 *
 * For now orders are saved to OUR database only — no Foodics, no real payment.
 */
import type { Order, OrderItem } from '@prisma/client';
import { prisma } from '../../database/prisma';
import { BadRequest, NotFound } from '../../common/errors';
import { DELIVERY_FEE, vatOf } from '../../common/money';
import type { CreateOrderInput, UpdateStatusInput } from './orders.schemas';

type OrderWithItems = Order & { items: OrderItem[] };

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
    for (const optionId of item.modifierOptionIds) {
      const option = validOptions.get(optionId);
      if (!option) throw BadRequest(`خيار غير صالح لهذا المنتج: ${optionId}`);
      unitPrice += option.price;
    }

    const totalPrice = unitPrice * item.quantity;
    return {
      productId: product.id,
      productName: product.nameAr,
      quantity: item.quantity,
      unitPrice,
      totalPrice,
      notes: item.notes,
    };
  });

  // 3) Totals (all in halalas).
  const subtotal = lines.reduce((sum, l) => sum + l.totalPrice, 0);
  const vat = vatOf(subtotal);
  const deliveryFee = input.type === 'DELIVERY' ? DELIVERY_FEE : 0;
  // Discount must be authorized server-side (coupon/points). Until that exists we
  // never apply a client-supplied discount — it's forced to 0.
  const discount = 0;
  const total = Math.max(0, subtotal + vat + deliveryFee - discount);

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
    include: { items: true },
  });

  // 5) Simplified Path-A loyalty: each ordered item adds a "cup".
  const cups = lines.reduce((sum, l) => sum + l.quantity, 0);
  await prisma.loyaltyCounter.upsert({
    where: { customerId },
    create: { customerId, cupCount: cups, goal: 6 },
    update: { cupCount: { increment: cups } },
  });

  return toOrderDTO(order);
}

export async function listOrders(customerId: string) {
  const orders = await prisma.order.findMany({
    where: { customerId },
    include: { items: true },
    orderBy: { createdAt: 'desc' },
  });
  return orders.map(toOrderDTO);
}

export async function getOrderById(id: string, requesterId: string) {
  const order = await prisma.order.findUnique({ where: { id }, include: { items: true } });
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
    include: { items: true },
  });
  return toOrderDTO(order);
}
