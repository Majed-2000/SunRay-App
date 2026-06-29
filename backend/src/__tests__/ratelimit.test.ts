import express from 'express';
import request from 'supertest';
import { describe, it, expect } from 'vitest';
import { createLimiter } from '../common/rateLimit';

// The app-mounted limiters skip during tests (so the suite isn't throttled), so
// we exercise the factory directly on a throwaway app to assert 429 behavior.
describe('rate limiting', () => {
  it('returns 429 with the RATE_LIMITED envelope once the limit is exceeded', async () => {
    const app = express();
    app.use(createLimiter({ windowMs: 60_000, limit: 2 }));
    app.get('/', (_req, res) => res.json({ ok: true, data: 'ok' }));

    const agent = request(app);
    expect((await agent.get('/')).status).toBe(200);
    expect((await agent.get('/')).status).toBe(200);

    const blocked = await agent.get('/');
    expect(blocked.status).toBe(429);
    expect(blocked.body.ok).toBe(false);
    expect(blocked.body.error.code).toBe('RATE_LIMITED');
  });
});
