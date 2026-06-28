/**
 * Loyalty service — Path A cup counter ("buy 6 coffees, get the 7th free").
 * OUR backend owns the counter (Foodics loyalty is amount-based, so it can't
 * count cups). Redeeming issues a reward code and subtracts the goal from the count.
 */
import { randomInt } from 'node:crypto';
import { prisma } from '../../database/prisma';
import { BadRequest, NotFound } from '../../common/errors';

async function ensureCustomer(customerId: string) {
  const found = await prisma.customer.findUnique({ where: { id: customerId }, select: { id: true } });
  if (!found) throw NotFound('العميل غير موجود');
}

function rewardCode() {
  return `SR-FREE-${randomInt(1000, 9999)}`;
}

/** Get the counter, creating it (goal 6) if it doesn't exist yet. */
export async function getCounter(customerId: string) {
  await ensureCustomer(customerId);
  const counter = await prisma.loyaltyCounter.upsert({
    where: { customerId },
    create: { customerId, cupCount: 0, goal: 6 },
    update: {},
  });
  return {
    customerId: counter.customerId,
    cupCount: counter.cupCount,
    goal: counter.goal,
    updatedAt: counter.updatedAt.getTime(),
  };
}

export async function redeem(customerId: string) {
  await ensureCustomer(customerId);
  const counter = await prisma.loyaltyCounter.findUnique({ where: { customerId } });
  const goal = counter?.goal ?? 6;
  const cups = counter?.cupCount ?? 0;
  if (cups < goal) {
    throw BadRequest(`تحتاج ${goal - cups} أكواب إضافية للحصول على مكافأة`);
  }

  const reward = await prisma.loyaltyReward.create({
    data: { customerId, code: rewardCode(), type: 'FREE_COFFEE', status: 'ACTIVE' },
  });
  await prisma.loyaltyCounter.update({
    where: { customerId },
    data: { cupCount: { decrement: goal } },
  });

  return {
    reward: {
      id: reward.id,
      code: reward.code,
      type: reward.type,
      status: reward.status,
      issuedAt: reward.issuedAt.getTime(),
    },
    counter: await getCounter(customerId),
  };
}
