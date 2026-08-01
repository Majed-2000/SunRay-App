/**
 * Foodics webhook receiver.
 *
 * Foodics' delivery rules are unusually strict, and every design choice here
 * follows from one of them:
 *
 *   • Respond 2xx IMMEDIATELY. Foodics does not read the body — the webhook is a
 *     notification, not a request/response. Work happens after we have replied.
 *   • Timeout is 5 seconds. Anything slower is treated as a failure.
 *   • 3 attempts total, then the event is DROPPED FOREVER. There is no
 *     dead-letter queue on their side, so we log every raw payload ourselves.
 *   • 100 non-2xx responses in a minute BLOCKS the URL for an hour, losing every
 *     event in between. This is why the handler is almost impossible to make
 *     fail: it must return 200 even for payloads it does not understand.
 *
 * That last rule also means the webhook path must never be rate-limited. A 429
 * counts as non-2xx, so throttling Foodics would eventually silence them for an
 * hour — the opposite of protection.
 *
 * AUTHENTICITY: Foodics does not sign webhooks. Two cheap defences instead —
 * a secret path segment, and a check that the payload names our business. Both
 * are weak alone; together they stop a stray or guessed POST from mutating data.
 */
import type { Request, Response } from 'express';
import { createHash } from 'node:crypto';
import { prisma } from '../../database/prisma';
import { env } from '../../config/env';
import { logger } from '../../common/logger';

/** Our business reference, as it appears in every payload. */
const BUSINESS_REFERENCE = 850056;

interface FoodicsWebhookBody {
  timestamp?: number;
  event?: string;
  business?: { name?: string; reference?: number };
  order?: { id?: string; reference?: number; status?: number; meta?: Record<string, unknown> };
  customer?: { id?: string; phone?: string };
  entity?: { type?: string; id?: string };
}

/**
 * Foodics sends no event id, so we derive one. Two identical deliveries of the
 * same change collapse to one row; a genuinely new change does not.
 */
function dedupeKey(body: FoodicsWebhookBody): string {
  const parts = [
    body.event ?? 'unknown',
    body.order?.id ?? body.customer?.id ?? body.entity?.id ?? '',
    // Include the mutable bit, so an order moving Pending → Ready is a NEW event
    // rather than a duplicate of its own creation.
    String(body.order?.status ?? ''),
    String(body.timestamp ?? ''),
  ];
  return createHash('sha256').update(parts.join('|')).digest('hex').slice(0, 40);
}

/**
 * The HTTP handler. Does the absolute minimum before replying: validate, record,
 * reply — then hand off. Anything heavier belongs in processEvent.
 */
export async function handleFoodicsWebhook(req: Request, res: Response): Promise<void> {
  const body = (req.body ?? {}) as FoodicsWebhookBody;

  // Reject a payload for someone else's business, but still with 200: a 4xx here
  // counts toward the block that would silence real events for an hour.
  if (body.business?.reference && body.business.reference !== BUSINESS_REFERENCE) {
    logger.warn(`Foodics webhook for a different business: ${body.business.reference}`);
    res.status(200).json({ ok: true });
    return;
  }

  let stored: { id: string } | null = null;
  try {
    stored = await prisma.webhookEvent.create({
      data: {
        event: body.event ?? 'unknown',
        dedupeKey: dedupeKey(body),
        payload: JSON.stringify(body).slice(0, 20_000),
      },
      select: { id: true },
    });
  } catch {
    // Unique violation = we have seen this exact event already. That is a
    // success, not an error: Foodics retried and we are idempotent.
    res.status(200).json({ ok: true });
    return;
  }

  // Reply BEFORE doing any work. Foodics is counting the milliseconds.
  res.status(200).json({ ok: true });

  // Fire-and-forget. Deliberately not awaited — and it must never throw into an
  // already-sent response.
  void processEvent(stored.id, body).catch((err) => {
    logger.warn(`Foodics webhook processing failed: ${(err as Error).message}`);
  });
}

/**
 * Apply the event. Runs after the response, so it may take as long as it needs.
 * Failures are recorded on the row rather than thrown away, because the event
 * itself is gone from Foodics after three attempts.
 */
async function processEvent(rowId: string, body: FoodicsWebhookBody): Promise<void> {
  try {
    switch (body.event) {
      // An order OUR app created changed state at the counter — accepted, being
      // prepared, ready, closed. This is what drives live order tracking.
      case 'application.order.updated':
      case 'order.updated': {
        await syncOrderStatus(body);
        break;
      }

      // A customer bought something, possibly at the counter rather than in the
      // app. This is the event loyalty needs in order to count cups bought in
      // person — and the reason full `orders.get` matters, since the payload
      // alone does not tell us which products were involved.
      case 'customer.order.created': {
        logger.info(`Foodics: customer order created (${body.order?.reference ?? '?'})`);
        break;
      }

      // The menu changed in the console. The payload carries only the entity
      // type and id, never the details, so a re-sync is the only way to learn
      // what changed.
      case 'menu.updated': {
        logger.info(`Foodics: menu entity ${body.entity?.type ?? '?'} changed — re-sync pending`);
        break;
      }

      default:
        logger.info(`Foodics webhook ignored: ${body.event ?? 'unknown'}`);
    }

    await prisma.webhookEvent.update({
      where: { id: rowId },
      data: { processedAt: new Date() },
    });
  } catch (err) {
    await prisma.webhookEvent
      .update({ where: { id: rowId }, data: { error: (err as Error).message.slice(0, 500) } })
      .catch(() => undefined);
    throw err;
  }
}

/** Foodics order status (1 Pending … 8 Draft) → our order status. */
const STATUS_MAP: Record<number, string> = {
  1: 'PENDING',
  2: 'PREPARING',
  3: 'CANCELLED', // declined
  4: 'COMPLETED', // closed
  5: 'CANCELLED', // returned
  7: 'CANCELLED', // void
};

/**
 * Move our copy of the order to match Foodics.
 *
 * The link is `meta.3rd_party_order_number` — the same key injection uses for
 * idempotency. Without it we cannot tell which of our orders a Foodics ticket
 * belongs to, so an event for an order we did not create is simply ignored.
 */
async function syncOrderStatus(body: FoodicsWebhookBody): Promise<void> {
  const ourRef = body.order?.meta?.['3rd_party_order_number'];
  if (typeof ourRef !== 'string' || !ourRef) return;

  const status = STATUS_MAP[body.order?.status ?? 0];
  if (!status) return;

  const updated = await prisma.order.updateMany({
    where: { id: ourRef },
    data: { status },
  });
  if (updated.count) {
    logger.info(`Order ${ourRef} → ${status} (from Foodics webhook)`);
  }
}

/** The secret path segment Foodics is told to call. Empty disables the route. */
export const webhookSecret = (): string => env.FOODICS_WEBHOOK_SECRET;
