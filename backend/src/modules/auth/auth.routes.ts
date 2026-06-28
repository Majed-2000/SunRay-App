import { Router } from 'express';
import { asyncHandler } from '../../common/errors';
import { ok } from '../../common/response';
import { loginSchema, verifySchema } from './auth.schemas';
import * as service from './auth.service';

export const authRouter = Router();

// POST /api/auth/login  { phone }  -> mock OTP session
authRouter.post(
  '/login',
  asyncHandler(async (req, res) => {
    const { phone } = loginSchema.parse(req.body);
    ok(res, service.requestOtp(phone));
  }),
);

// POST /api/auth/verify  { phone, code }  -> { customer, token }
authRouter.post(
  '/verify',
  asyncHandler(async (req, res) => {
    const { phone, code } = verifySchema.parse(req.body);
    ok(res, await service.verifyOtp(phone, code));
  }),
);
