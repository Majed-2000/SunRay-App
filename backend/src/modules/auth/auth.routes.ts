import { Router } from 'express';
import { asyncHandler } from '../../common/errors';
import { ok } from '../../common/response';
import { authLimiter } from '../../common/rateLimit';
import { authenticate } from '../../middleware/authenticate';
import { loginSchema, verifySchema, refreshSchema } from './auth.schemas';
import * as service from './auth.service';

export const authRouter = Router();

// POST /api/auth/login  { phone }  -> mock OTP session
authRouter.post(
  '/login',
  authLimiter,
  asyncHandler(async (req, res) => {
    const { phone } = loginSchema.parse(req.body);
    ok(res, await service.requestOtp(phone));
  }),
);

// POST /api/auth/verify  { phone, code }  -> { accessToken, refreshToken, expiresIn, customer }
authRouter.post(
  '/verify',
  authLimiter,
  asyncHandler(async (req, res) => {
    const { phone, code } = verifySchema.parse(req.body);
    ok(res, await service.verifyOtp(phone, code, req.headers['user-agent']));
  }),
);

// POST /api/auth/refresh  { refreshToken }  -> { accessToken, refreshToken, expiresIn }
authRouter.post(
  '/refresh',
  authLimiter,
  asyncHandler(async (req, res) => {
    const { refreshToken } = refreshSchema.parse(req.body);
    ok(res, await service.refresh(refreshToken, req.headers['user-agent']));
  }),
);

// POST /api/auth/logout  (access-protected)  -> revoke the current session
authRouter.post(
  '/logout',
  authenticate,
  asyncHandler(async (req, res) => {
    await service.logout(req.auth!.sessionId);
    ok(res, { success: true });
  }),
);

// GET /api/auth/me  (access-protected)  -> current session's customer
authRouter.get(
  '/me',
  authenticate,
  asyncHandler(async (req, res) => {
    ok(res, await service.me(req.auth!.customerId));
  }),
);
