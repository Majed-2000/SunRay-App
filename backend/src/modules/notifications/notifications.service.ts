import type { Notification } from '@prisma/client';
import { prisma } from '../../database/prisma';
import { NotFound } from '../../common/errors';

function toNotificationDTO(n: Notification) {
  return {
    id: n.id,
    type: n.type,
    title: n.title,
    body: n.body,
    isRead: n.isRead,
    createdAt: n.createdAt.getTime(),
  };
}

async function ensureCustomer(customerId: string) {
  const found = await prisma.customer.findUnique({ where: { id: customerId }, select: { id: true } });
  if (!found) throw NotFound('العميل غير موجود');
}

export async function list(customerId: string) {
  await ensureCustomer(customerId);
  const items = await prisma.notification.findMany({
    where: { customerId },
    orderBy: { createdAt: 'desc' },
  });
  return items.map(toNotificationDTO);
}

export async function markAllRead(customerId: string) {
  await ensureCustomer(customerId);
  const result = await prisma.notification.updateMany({
    where: { customerId, isRead: false },
    data: { isRead: true },
  });
  return { updated: result.count };
}
