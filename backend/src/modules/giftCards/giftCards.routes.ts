import { Router } from 'express';
import { asyncHandler } from '../../common/errors';
import { ok, created } from '../../common/response';
import { issueGiftCardSchema, redeemGiftCardSchema } from './giftCards.schemas';
import * as service from './giftCards.service';

// Top-level: /api/gift-cards
export const giftCardsRouter = Router();

// POST /api/gift-cards  → issue a new card
giftCardsRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const input = issueGiftCardSchema.parse(req.body);
    created(res, await service.issueGiftCard(input));
  }),
);

// POST /api/gift-cards/redeem  { code, customerId }  → credits recipient wallet
giftCardsRouter.post(
  '/redeem',
  asyncHandler(async (req, res) => {
    const input = redeemGiftCardSchema.parse(req.body);
    ok(res, await service.redeem(input));
  }),
);

// Customer-scoped: /api/customers/:id/gift-cards
export const customerGiftCardsRouter = Router({ mergeParams: true });

// GET /api/customers/:id/gift-cards
customerGiftCardsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    ok(res, await service.listForCustomer(req.params.id));
  }),
);
