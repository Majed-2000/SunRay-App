import { describe, it, expect } from 'vitest';
import { api, loginAs, bearer } from './helpers';

describe('input validation → 422 with the standard envelope', () => {
  it('rejects a malformed phone on login', async () => {
    const res = await api().post('/api/auth/login').send({ phone: '123' });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details.fieldErrors.phone).toBeTruthy();
  });

  it('rejects a junk product id (param validation)', async () => {
    const res = await api().get('/api/products/not-a-valid-id!!');
    expect(res.status).toBe(422);
  });

  it('rejects an order with no items', async () => {
    const auth = await loginAs('592000001');
    const res = await api().post('/api/orders').set(bearer(auth.accessToken)).send({ type: 'PICKUP', items: [] });
    expect(res.status).toBe(422);
  });

  it('unknown routes return a NOT_FOUND envelope', async () => {
    const res = await api().get('/api/does-not-exist');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});
