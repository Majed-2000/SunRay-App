import { describe, it, expect } from 'vitest';
import { api, loginAs, bearer } from './helpers';

describe('auth: login → verify → me → refresh → logout', () => {
  it('login returns a mock OTP session', async () => {
    const res = await api().post('/api/auth/login').send({ phone: '590000001' });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.data.expiresInSeconds).toBeGreaterThan(0);
  });

  it('verify returns access + refresh tokens and the customer', async () => {
    const res = await api().post('/api/auth/verify').send({ phone: '590000002', code: '1234' });
    expect(res.status).toBe(200);
    expect(typeof res.body.data.accessToken).toBe('string');
    expect(typeof res.body.data.refreshToken).toBe('string');
    expect(res.body.data.customer.phone).toBe('590000002');
  });

  it('GET /me requires a valid access token', async () => {
    const auth = await loginAs('590000003');
    expect((await api().get('/api/auth/me')).status).toBe(401);

    const ok = await api().get('/api/auth/me').set(bearer(auth.accessToken));
    expect(ok.status).toBe(200);
    expect(ok.body.data.id).toBe(auth.customer.id);
  });

  it('refresh rotates the refresh token (old one stops working)', async () => {
    const auth = await loginAs('590000004');
    const r1 = await api().post('/api/auth/refresh').send({ refreshToken: auth.refreshToken });
    expect(r1.status).toBe(200);
    expect(r1.body.data.refreshToken).not.toBe(auth.refreshToken);

    // The original refresh token was rotated away → reuse must fail.
    const reuse = await api().post('/api/auth/refresh').send({ refreshToken: auth.refreshToken });
    expect(reuse.status).toBe(401);
  });

  it('logout revokes the session immediately (even for an unexpired access token)', async () => {
    const auth = await loginAs('590000005');
    expect((await api().post('/api/auth/logout').set(bearer(auth.accessToken))).status).toBe(200);

    // Same still-valid JWT, but the session is revoked → 401.
    expect((await api().get('/api/auth/me').set(bearer(auth.accessToken))).status).toBe(401);
    // Its refresh token is dead too.
    expect((await api().post('/api/auth/refresh').send({ refreshToken: auth.refreshToken })).status).toBe(401);
  });

  it('rejects a forged/garbage bearer token', async () => {
    expect((await api().get('/api/auth/me').set(bearer('not.a.jwt'))).status).toBe(401);
  });
});
