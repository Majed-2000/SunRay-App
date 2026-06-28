/**
 * Health check — a simple endpoint to confirm the server is alive. Useful for
 * the app, for uptime monitors, and for you while learning ("is it running?").
 */
import { Router } from 'express';
import { ok } from '../../common/response';

export const healthRouter = Router();

healthRouter.get('/', (_req, res) => {
  ok(res, { status: 'ok', uptime: Math.round(process.uptime()), time: new Date().toISOString() });
});
