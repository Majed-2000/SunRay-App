/**
 * Account deletion.
 *
 * Apple (App Store Guideline 5.1.1(v)) and Google Play both REQUIRE an in-app
 * way to delete an account whenever the app lets you create one. Without this
 * the app is rejected, so this is not optional polish.
 *
 * ── What is erased vs. what survives, and why ────────────────────────────────
 *
 * ERASED — everything that identifies a person:
 *   name, phone, email, gender, city, birthday, saved addresses, loyalty
 *   counters and rewards, notifications, and every login session.
 *
 * RETAINED — financial records, with the person detached:
 *   orders, order items and wallet transactions stay, still pointing at a now
 *   anonymised customer row. Saudi tax rules (ZATCA) require invoices to be
 *   kept; deleting them would also corrupt the café's sales history. Nothing
 *   left in them names the customer.
 *
 * This is why we anonymise rather than hard-delete the row: `Order.customerId`
 * is a foreign key, and dropping the customer would either fail or cascade into
 * records we are obliged to keep. The privacy policy must state this retention.
 *
 * NOT TOUCHED — Foodics:
 *   The customer also exists in the POS with their own order history, created at
 *   the counter and owned by the business. We hold read-only access and must not
 *   modify it. Deleting here removes them from the app, not from the café's POS;
 *   that request goes to the business directly.
 */
import { createHash } from 'node:crypto';
import { prisma } from '../../database/prisma';
import { logger } from '../../common/logger';
import { getBalance } from '../wallet/wallet.service';

export interface DeleteAccountResult {
  deleted: true;
  /** Balance forfeited at deletion, in halalas — echoed back for the receipt. */
  forfeitedWalletBalance: number;
}

/** Placeholder shown wherever a name is still rendered on retained records. */
const ANONYMOUS_NAME = 'حساب محذوف';

export async function deleteAccount(customerId: string): Promise<DeleteAccountResult> {
  const balance = await getBalance(customerId);

  await prisma.$transaction(async (tx) => {
    // Order matters: children before the rows they point at.
    await tx.address.deleteMany({ where: { customerId } });
    await tx.loyaltyReward.deleteMany({ where: { customerId } });
    await tx.loyaltyCounter.deleteMany({ where: { customerId } });
    await tx.notification.deleteMany({ where: { customerId } });

    // Kill every session immediately — deletion must log the person out
    // everywhere, not just on the device that asked.
    await tx.session.updateMany({
      where: { customerId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    // Detach gift cards without destroying the cards themselves: a card this
    // person sent may still be unredeemed in someone else's hands, and its
    // value must not evaporate because the sender left.
    await tx.giftCard.updateMany({ where: { senderCustomerId: customerId }, data: { senderCustomerId: null } });
    await tx.giftCard.updateMany({ where: { redeemedByCustomerId: customerId }, data: { redeemedByCustomerId: null } });

    // Anonymise. `phone` is unique and is how login finds an account, so it gets
    // a value no real phone can collide with — a hash, not the raw number, so
    // the record cannot be traced back to the person who left.
    const tombstone = `deleted:${createHash('sha256').update(customerId).digest('hex').slice(0, 24)}`;
    await tx.customer.update({
      where: { id: customerId },
      data: {
        name: ANONYMOUS_NAME,
        phone: tombstone,
        email: null,
        gender: null,
        city: null,
        birthDay: null,
        birthMonth: null,
        // Drop the Foodics link too: leaving it would let a future sync or
        // history lookup re-attach a real person to this dead row.
        foodicsId: null,
      },
    });
  });

  // Never log the phone or name of a deleting customer — that would defeat the
  // deletion by leaving the identity in the log.
  logger.info(`Account deleted (customer ${customerId.slice(0, 8)}…)`);

  return { deleted: true, forfeitedWalletBalance: balance };
}
