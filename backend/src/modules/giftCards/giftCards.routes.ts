import { Router } from 'express';
import { asyncHandler } from '../../common/errors';
import { ok, created } from '../../common/response';
import { authenticate } from '../../middleware/authenticate';
import { giftRedeemLimiter } from '../../common/rateLimit';
import { issueGiftCardSchema, redeemGiftCardSchema } from './giftCards.schemas';
import * as service from './giftCards.service';

// Top-level: /api/gift-cards
export const giftCardsRouter = Router();

// POST /api/gift-cards  → issue a new card (sender = authenticated customer)
giftCardsRouter.post(
  '/',
  authenticate,
  asyncHandler(async (req, res) => {
    const input = issueGiftCardSchema.parse(req.body);
    created(res, await service.issueGiftCard(input, req.auth!.customerId));
  }),
);

// POST /api/gift-cards/redeem  { code }  → credits the AUTHENTICATED customer's wallet
giftCardsRouter.post(
  '/redeem',
  authenticate,
  giftRedeemLimiter,
  asyncHandler(async (req, res) => {
    const { code } = redeemGiftCardSchema.parse(req.body);
    ok(res, await service.redeem(code, req.auth!.customerId));
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
