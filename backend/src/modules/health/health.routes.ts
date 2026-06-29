/**
 * Health checks.
 *
 * - GET /health        → liveness: the process is up (fast, no dependencies).
 * - GET /health/ready  → readiness: the process can reach the database. Hosting
 *   platforms hit this before routing traffic to a new deploy.
 */
import { Router } from 'express';
import { ok } from '../../common/response';
import { ServiceUnavailable } from '../../common/errors';
import { prisma } from '../../database/prisma';

export const healthRouter = Router();

healthRouter.get('/', (_req, res) => {
  ok(res, { status: 'ok', uptime: Math.round(process.uptime()), time: new Date().toISOString() });
});

healthRouter.get('/ready', async (_req, res, next) => {
  try {
    // Cheap constant probe — confirms the DB connection works. No user input, so
    // there is no injection surface (see backend/SECURITY.md on raw SQL).
    await prisma.$queryRaw`SELECT 1`;
    ok(res, { status: 'ready' });
  } catch {
    next(ServiceUnavailable('قاعدة البيانات غير متاحة'));
  }
});
