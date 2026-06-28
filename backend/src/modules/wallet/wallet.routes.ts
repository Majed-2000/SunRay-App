/**
 * Wallet routes are customer-scoped: /api/customers/:id/wallet ...
 * (mounted under /api/customers with mergeParams so we can read :id here).
 */
import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../common/errors';
import { ok } from '../../common/response';
import * as service from './wallet.service';

// Top-up amount is in halalas (e.g. 5000 = 50.00 SAR), minimum 1 SAR.
const topUpSchema = z.object({ amount: z.number().int().min(100).max(1_000_000) });

export const walletRouter = Router({ mergeParams: true });

// GET /api/customers/:id/wallet
walletRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    ok(res, await service.getWallet(req.params.id));
  }),
);

// POST /api/customers/:id/wallet/top-up  { amount }  (amount in halalas)
walletRouter.post(
  '/top-up',
  asyncHandler(async (req, res) => {
    const { amount } = topUpSchema.parse(req.body);
    ok(res, await service.topUp(req.params.id, amount));
  }),
);
