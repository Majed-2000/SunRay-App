/**
 * Customer routes. Each route: authenticate → ensure you're acting on YOUR OWN
 * record (requireSelfParam) → validate input (Zod) → call the service → reply.
 * `asyncHandler` forwards errors to the error handler.
 */
import { Router } from 'express';
import { asyncHandler } from '../../common/errors';
import { ok, created } from '../../common/response';
import { authenticate } from '../../middleware/authenticate';
import { requireSelfParam } from '../../middleware/requireSelf';
import { addAddressSchema, updateProfileSchema } from './customers.schemas';
import * as service from './customers.service';
import { deleteAccount } from './deleteAccount.service';

export const customersRouter = Router();

// This router is mounted at /api/customers (no :id in the mount path), so the
// ownership guard is applied per-route where req.params.id is available.
const self = [authenticate, requireSelfParam('id')];

// DELETE /api/customers/me  → erase the caller's account.
//
// Required by App Store 5.1.1(v) and Google Play. Declared before '/:id' so
// Express does not read "me" as an id, and it takes NO id at all: the target
// comes from the session token, so nobody can delete somebody else's account by
// changing a path segment.
customersRouter.delete(
  '/me',
  authenticate,
  asyncHandler(async (req, res) => {
    ok(res, await deleteAccount(req.auth!.customerId));
  }),
);

// GET /api/customers/:id
customersRouter.get(
  '/:id',
  ...self,
  asyncHandler(async (req, res) => {
    ok(res, await service.getCustomerById(req.params.id));
  }),
);

// PATCH /api/customers/:id
customersRouter.patch(
  '/:id',
  ...self,
  asyncHandler(async (req, res) => {
    const patch = updateProfileSchema.parse(req.body);
    ok(res, await service.updateProfile(req.params.id, patch));
  }),
);

// GET /api/customers/:id/addresses
customersRouter.get(
  '/:id/addresses',
  ...self,
  asyncHandler(async (req, res) => {
    ok(res, await service.listAddresses(req.params.id));
  }),
);

// POST /api/customers/:id/addresses
customersRouter.post(
  '/:id/addresses',
  ...self,
  asyncHandler(async (req, res) => {
    const input = addAddressSchema.parse(req.body);
    created(res, await service.addAddress(req.params.id, input));
  }),
);
