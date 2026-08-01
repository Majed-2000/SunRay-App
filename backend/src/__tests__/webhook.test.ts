/**
 * Foodics webhook receiver.
 *
 * These pin behaviour that looks wrong until you know Foodics' rules: the
 * handler answers 200 even to payloads it rejects, because 100 non-2xx replies
 * in a minute make Foodics block the URL for an hour and drop every event in
 * between. Returning an honest 400 would cost us real order updates.
 */
import { describe, expect, it, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../app';
import { prisma } from '../database/prisma';
import { env } from '../config/env';

const SECRET = env.FOODICS_WEBHOOK_SECRET;
const url = (s = SECRET) => `/api/foodics/webhook/${s}`;

const payload = (over: Record<string, unknown> = {}) => ({
  timestamp: 1785600000,
  event: 'application.order.updated',
  business: { name: 'sunray', reference: 850056 },
  order: { id: 'f-1', reference: 999001, status: 2, meta: {} },
  ...over,
});

describe.skipIf(!SECRET)('Foodics webhook', () => {
  beforeEach(async () => {
    await prisma.webhookEvent.deleteMany({});
  });

  it('accepts a valid event and records it once', async () => {
    const res = await request(app).post(url()).send(payload());
    expect(res.status).toBe(200);

    const rows = await prisma.webhookEvent.findMany({});
    expect(rows).toHaveLength(1);
    expect(rows[0].event).toBe('application.order.updated');
  });

  it('is idempotent — a retry of the same event stores nothing new', async () => {
    await request(app).post(url()).send(payload());
    const second = await request(app).post(url()).send(payload());

    // Still 200: a duplicate is a success, not an error. Foodics retries by
    // design and must not be told it failed.
    expect(second.status).toBe(200);
    expect(await prisma.webhookEvent.count()).toBe(1);
  });

  it('treats a status change as a NEW event, not a duplicate', async () => {
    await request(app).post(url()).send(payload({ order: { id: 'f-1', status: 2, meta: {} } }));
    await request(app).post(url()).send(payload({ order: { id: 'f-1', status: 4, meta: {} } }));
    expect(await prisma.webhookEvent.count()).toBe(2);
  });

  it('answers 200 to another business, and records nothing', async () => {
    const res = await request(app)
      .post(url())
      .send(payload({ business: { name: 'someone else', reference: 111111 } }));

    expect(res.status).toBe(200); // NOT 403 — see the file header
    expect(await prisma.webhookEvent.count()).toBe(0);
  });

  it('answers 200 to an unknown event type rather than failing', async () => {
    const res = await request(app).post(url()).send(payload({ event: 'something.we.do.not.handle' }));
    expect(res.status).toBe(200);
  });

  it('404s on a wrong secret — the path itself is the authenticity check', async () => {
    const res = await request(app).post(url('not-the-secret')).send(payload());
    expect(res.status).toBe(404);
  });
});
