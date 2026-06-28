import { Router } from 'express';
import { asyncHandler } from '../../common/errors';
import { ok } from '../../common/response';
import * as service from './loyalty.service';

// Customer-scoped: /api/customers/:id/loyalty ...
export const loyaltyRouter = Router({ mergeParams: true });

// GET /api/customers/:id/loyalty
loyaltyRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    ok(res, await service.getCounter(req.params.id));
  }),
);

// POST /api/customers/:id/loyalty/redeem
loyaltyRouter.post(
  '/redeem',
  asyncHandler(async (req, res) => {
    ok(res, await service.redeem(req.params.id));
  }),
);
