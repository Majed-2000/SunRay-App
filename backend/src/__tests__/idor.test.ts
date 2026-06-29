import { describe, it, expect, beforeAll } from 'vitest';
import { api, loginAs, bearer, seedProduct } from './helpers';

describe('IDOR prevention + identity derived from token', () => {
  let A: Awaited<ReturnType<typeof loginAs>>;
  let B: Awaited<ReturnType<typeof loginAs>>;
  let productId: string;

  beforeAll(async () => {
    A = await loginAs('591000001');
    B = await loginAs('591000002');
    productId = await seedProduct();
  });

  it('a customer can read their own profile but not another customer’s (403)', async () => {
    expect((await api().get(`/api/customers/${A.customer.id}`).set(bearer(A.accessToken))).status).toBe(200);
    expect((await api().get(`/api/customers/${B.customer.id}`).set(bearer(A.accessToken))).status).toBe(403);
    expect((await api().get(`/api/customers/${A.customer.id}`)).status).toBe(401); // no token
  });

  it('order creation requires auth and ignores client-supplied customerId/discount', async () => {
    // Guest (no token) cannot create an order.
    const noAuth = await api().post('/api/orders').send({ type: 'PICKUP', items: [{ productId, quantity: 1 }] });
    expect(noAuth.status).toBe(401);

    // A creates, trying to spoof B as the owner and inject a discount — both ignored.
    const created = await api()
      .post('/api/orders')
      .set(bearer(A.accessToken))
      .send({ type: 'PICKUP', items: [{ productId, quantity: 2 }], customerId: B.customer.id, discount: 9999 });
    expect(created.status).toBe(201);
    expect(created.body.data.customerId).toBe(A.customer.id);
    expect(created.body.data.discount).toBe(0);
  });

  it('an order is only readable by its owner (404 for others, not 403)', async () => {
    const created = await api()
      .post('/api/orders')
      .set(bearer(A.accessToken))
      .send({ type: 'PICKUP', items: [{ productId, quantity: 1 }] });
    const orderId = created.body.data.id;

    expect((await api().get(`/api/orders/${orderId}`).set(bearer(A.accessToken))).status).toBe(200);
    expect((await api().get(`/api/orders/${orderId}`).set(bearer(B.accessToken))).status).toBe(404);
  });

  it('the order list is scoped to the authenticated customer', async () => {
    const aList = await api().get('/api/orders').set(bearer(A.accessToken));
    const bList = await api().get('/api/orders').set(bearer(B.accessToken));
    expect(aList.status).toBe(200);
    // Every order A sees belongs to A.
    expect(aList.body.data.every((o: { customerId: string }) => o.customerId === A.customer.id)).toBe(true);
    expect(bList.body.data.every((o: { customerId: string }) => o.customerId === B.customer.id)).toBe(true);
  });

  it('gift card issue/redeem require auth', async () => {
    expect((await api().post('/api/gift-cards').send({ recipientPhone: '599999999', amount: 5000 })).status).toBe(401);
    expect((await api().post('/api/gift-cards/redeem').send({ code: 'SR-GIFT-1-2' })).status).toBe(401);
  });
});
