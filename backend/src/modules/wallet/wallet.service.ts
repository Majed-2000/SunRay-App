/**
 * Wallet service. The wallet is a stored balance + a list of transactions.
 * Every change writes a transaction row and records the resulting `balanceAfter`,
 * so the balance is always traceable (an "audit trail").
 *
 * All amounts are in halalas. `creditWallet` is reused by the gift-card module.
 */
import type { WalletTransaction } from '@prisma/client';
import { prisma } from '../../database/prisma';
import { NotFound } from '../../common/errors';

type WalletSource = 'TOP_UP' | 'ORDER_PAYMENT' | 'GIFT_CARD' | 'REFUND' | 'ADMIN';

function toTxDTO(t: WalletTransaction) {
  return {
    id: t.id,
    type: t.type,
    source: t.source,
    amount: t.amount,
    balanceAfter: t.balanceAfter,
    note: t.note ?? undefined,
    createdAt: t.createdAt.getTime(),
  };
}

async function ensureCustomer(customerId: string) {
  const found = await prisma.customer.findUnique({ where: { id: customerId }, select: { id: true } });
  if (!found) throw NotFound('العميل غير موجود');
}

/** Current balance = the most recent transaction's balanceAfter (or 0). */
export async function getBalance(customerId: string): Promise<number> {
  const last = await prisma.walletTransaction.findFirst({
    where: { customerId },
    orderBy: { createdAt: 'desc' },
    select: { balanceAfter: true },
  });
  return last?.balanceAfter ?? 0;
}

export async function getWallet(customerId: string) {
  await ensureCustomer(customerId);
  const [balance, transactions] = await Promise.all([
    getBalance(customerId),
    prisma.walletTransaction.findMany({ where: { customerId }, orderBy: { createdAt: 'desc' } }),
  ]);
  return { balance, transactions: transactions.map(toTxDTO) };
}

/** Add money to the wallet (returns the created transaction). */
export async function creditWallet(
  customerId: string,
  amount: number,
  source: WalletSource,
  note?: string,
) {
  const balanceAfter = (await getBalance(customerId)) + amount;
  return prisma.walletTransaction.create({
    data: { customerId, type: 'CREDIT', source, amount, balanceAfter, note },
  });
}

export async function topUp(customerId: string, amount: number) {
  await ensureCustomer(customerId);
  await creditWallet(customerId, amount, 'TOP_UP', 'شحن المحفظة');
  return getWallet(customerId);
}
