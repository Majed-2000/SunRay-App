/**
 * Gift cards service.
 *
 * A gift card carries a stored VALUE. When the recipient redeems it, that amount
 * is added to THEIR wallet balance (mock). The code is cash-like, so we only
 * accept it in the request body and never log it.
 */
import { randomInt } from 'node:crypto';
import type { GiftCard } from '@prisma/client';
import { prisma } from '../../database/prisma';
import { BadRequest, NotFound } from '../../common/errors';
import { creditWallet, getBalance } from '../wallet/wallet.service';
import type { IssueGiftCardInput } from './giftCards.schemas';

function toGiftCardDTO(c: GiftCard) {
  return {
    id: c.id,
    code: c.code,
    amount: c.amount,
    status: c.status,
    senderCustomerId: c.senderCustomerId ?? undefined,
    recipientPhone: c.recipientPhone,
    recipientName: c.recipientName ?? undefined,
    message: c.message ?? undefined,
    redeemedByCustomerId: c.redeemedByCustomerId ?? undefined,
    redeemedAt: c.redeemedAt ? c.redeemedAt.getTime() : undefined,
    createdAt: c.createdAt.getTime(),
  };
}

function generateCode() {
  return `SR-GIFT-${randomInt(1000, 9999)}-${randomInt(1000, 9999)}`;
}

export async function issueGiftCard(input: IssueGiftCardInput, senderCustomerId: string) {
  const card = await prisma.giftCard.create({
    data: {
      senderCustomerId,
      recipientPhone: input.recipientPhone,
      recipientName: input.recipientName,
      amount: input.amount,
      code: generateCode(),
      status: 'ACTIVE',
      message: input.message,
    },
  });
  return toGiftCardDTO(card);
}

export async function listForCustomer(customerId: string) {
  const found = await prisma.customer.findUnique({ where: { id: customerId }, select: { id: true } });
  if (!found) throw NotFound('العميل غير موجود');
  const cards = await prisma.giftCard.findMany({
    where: { OR: [{ senderCustomerId: customerId }, { redeemedByCustomerId: customerId }] },
    orderBy: { createdAt: 'desc' },
  });
  return cards.map(toGiftCardDTO);
}

export async function redeem(code: string, recipientCustomerId: string) {
  const card = await prisma.giftCard.findUnique({ where: { code } });
  if (!card) throw NotFound('البطاقة غير موجودة');
  if (card.status !== 'ACTIVE') throw BadRequest('هذه البطاقة غير قابلة للاستبدال');

  // Credit the recipient's wallet, then mark the card redeemed.
  await creditWallet(recipientCustomerId, card.amount, 'GIFT_CARD', 'استبدال بطاقة إهداء');
  const updated = await prisma.giftCard.update({
    where: { id: card.id },
    data: {
      status: 'REDEEMED',
      redeemedByCustomerId: recipientCustomerId,
      redeemedAt: new Date(),
    },
  });

  return {
    card: toGiftCardDTO(updated),
    walletBalance: await getBalance(recipientCustomerId),
  };
}
