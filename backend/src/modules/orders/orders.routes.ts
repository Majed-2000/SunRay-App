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

// GET /api/orders/history  → the caller's PAST orders from Foodics, i.e. what
// they bought at the counter before the app existed.
//
// MUST be declared before '/:id', otherwise Express matches "history" as an id.
//
// The phone is read from the database using the customer id in the token — it is
// never accepted from the query string or body. Taking it as a parameter would
// turn this into an IDOR that dumps any of the ~4,000 customers' names and
// purchase history to anyone who guesses a number.
//
// It also refuses to run while OTP_PROVIDER=mock; see foodics.history.ts.
ordersRouter.get(
  '/history',
  authenticate,
  asyncHandler(async (req, res) => {
    ok(res, await service.getFoodicsHistory(req.auth!.customerId));
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
