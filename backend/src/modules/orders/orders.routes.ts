import { Router } from 'express';
import { asyncHandler } from '../../common/errors';
import { ok, created } from '../../common/response';
import { createOrderSchema, updateStatusSchema } from './orders.schemas';
import * as service from './orders.service';

export const ordersRouter = Router();

// POST /api/orders  → create an order (saved to OUR DB only)
ordersRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const input = createOrderSchema.parse(req.body);
    created(res, await service.createOrder(input));
  }),
);

// GET /api/orders?customerId=...  → list orders
ordersRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const customerId = typeof req.query.customerId === 'string' ? req.query.customerId : undefined;
    ok(res, await service.listOrders(customerId));
  }),
);

// GET /api/orders/:id  → one order
ordersRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    ok(res, await service.getOrderById(req.params.id));
  }),
);

// PATCH /api/orders/:id/status  { status }
ordersRouter.patch(
  '/:id/status',
  asyncHandler(async (req, res) => {
    const input = updateStatusSchema.parse(req.body);
    ok(res, await service.updateStatus(req.params.id, input));
  }),
);
