import { Router } from 'express';
import { asyncHandler } from '../../common/errors';
import { ok } from '../../common/response';
import { validate, idParam } from '../../common/validate';
import * as service from './menu.service';

// GET /api/menu  → { categories, products }
export const menuRouter = Router();
menuRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    ok(res, await service.getMenu());
  }),
);

// GET /api/products/:id  (mounted separately at /api/products)
export const productsRouter = Router();
productsRouter.get(
  '/:id',
  validate({ params: idParam }),
  asyncHandler(async (req, res) => {
    ok(res, await service.getProductById(req.params.id));
  }),
);
