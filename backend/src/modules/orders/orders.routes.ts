import { Router } from 'express';
import { asyncHandler } from '../../common/errors';
import { ok, created } from '../../common/response';
import { validate, idParam } from '../../common/validate';
import { authenticate } from '../../middleware/authenticate';
import { requireDev } from '../../middleware/requireSelf';
import { orderCreateLimiter, devLimiter } from '../../common/rateLimit';
import { createOrderSchema, updateStatusSchema } from './orders.schemas';
import * as service from './orders.service';

export const ordersRouter = Router();

// POST /api/orders  → create an order for the AUTHENTICATED customer.
// The customer id comes from the token, never from the body.
ordersRouter.post(
  '/',
  authenticate,
  orderCreateLimiter,
  asyncHandler(async (req, res) => {
    const input = createOrderSchema.parse(req.body);
    created(res, await service.createOrder(input, req.auth!.customerId));
  }),
);

// GET /api/orders  → list ONLY the authenticated customer's orders.
ordersRouter.get(
  '/',
  authenticate,
  asyncHandler(async (req, res) => {
    ok(res, await service.listOrders(req.auth!.customerId));
  }),
);

// GET /api/orders/:id  → one order, only if it belongs to the caller.
ordersRouter.get(
  '/:id',
  authenticate,
  validate({ params: idParam }),
  asyncHandler(async (req, res) => {
    ok(res, await service.getOrderById(req.params.id, req.auth!.customerId));
  }),
);

// PATCH /api/orders/:id/status  { status }  → DEV/ADMIN ONLY (status override).
ordersRouter.patch(
  '/:id/status',
  authenticate,
  requireDev,
  devLimiter,
  validate({ params: idParam }),
  asyncHandler(async (req, res) => {
    const input = updateStatusSchema.parse(req.body);
    ok(res, await service.updateStatus(req.params.id, input));
  }),
);
