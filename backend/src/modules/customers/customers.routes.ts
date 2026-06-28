/**
 * Customer routes. Each route: validate input (Zod) → call the service → reply
 * with the standard envelope. `asyncHandler` forwards errors to the error handler.
 */
import { Router } from 'express';
import { asyncHandler } from '../../common/errors';
import { ok, created } from '../../common/response';
import { addAddressSchema, updateProfileSchema } from './customers.schemas';
import * as service from './customers.service';

export const customersRouter = Router();

// GET /api/customers/:id
customersRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    ok(res, await service.getCustomerById(req.params.id));
  }),
);

// PATCH /api/customers/:id
customersRouter.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const patch = updateProfileSchema.parse(req.body);
    ok(res, await service.updateProfile(req.params.id, patch));
  }),
);

// GET /api/customers/:id/addresses
customersRouter.get(
  '/:id/addresses',
  asyncHandler(async (req, res) => {
    ok(res, await service.listAddresses(req.params.id));
  }),
);

// POST /api/customers/:id/addresses
customersRouter.post(
  '/:id/addresses',
  asyncHandler(async (req, res) => {
    const input = addAddressSchema.parse(req.body);
    created(res, await service.addAddress(req.params.id, input));
  }),
);
