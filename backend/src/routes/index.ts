/**
 * Route table — connects every module to its URL.
 *
 * - `/health` lives at the root.
 * - everything else is under `/api`.
 * - some routers are "customer-scoped" (e.g. /api/customers/:id/wallet). They use
 *   `Router({ mergeParams: true })` so they can read `:id` from the mount path.
 *   We register these BEFORE the general `/customers` router so the more specific
 *   paths match first.
 */
import { Router } from 'express';
import { healthRouter } from '../modules/health/health.routes';
import { authRouter } from '../modules/auth/auth.routes';
import { customersRouter } from '../modules/customers/customers.routes';
import { branchesRouter } from '../modules/branches/branches.routes';
import { menuRouter, productsRouter } from '../modules/menu/menu.routes';
import { ordersRouter } from '../modules/orders/orders.routes';
import { walletRouter } from '../modules/wallet/wallet.routes';
import { loyaltyRouter } from '../modules/loyalty/loyalty.routes';
import { notificationsRouter } from '../modules/notifications/notifications.routes';
import { giftCardsRouter, customerGiftCardsRouter } from '../modules/giftCards/giftCards.routes';
import { foodicsRouter } from '../modules/foodics/foodics.routes';
import { authenticate } from '../middleware/authenticate';
import { requireSelfParam } from '../middleware/requireSelf';

export const rootRouter = Router();

// Health check at the root.
rootRouter.use('/health', healthRouter);

// Everything else under /api.
const api = Router();
api.use('/auth', authRouter);
// Operator-only (requireDev): Foodics status + menu sync. Not customer-facing.
api.use('/foodics', foodicsRouter);
api.use('/branches', branchesRouter);
api.use('/menu', menuRouter);
api.use('/products', productsRouter);
api.use('/orders', ordersRouter);
api.use('/gift-cards', giftCardsRouter);

// Customer-scoped routers (more specific → registered first). Every one is
// guarded: you must be logged in AND the `:id` must be YOUR id (IDOR prevention).
// These mount paths contain `:id`, so the guard sees req.params.id here.
const self = [authenticate, requireSelfParam('id')];
api.use('/customers/:id/wallet', ...self, walletRouter);
api.use('/customers/:id/loyalty', ...self, loyaltyRouter);
api.use('/customers/:id/notifications', ...self, notificationsRouter);
api.use('/customers/:id/gift-cards', ...self, customerGiftCardsRouter);
api.use('/customers', customersRouter);

rootRouter.use('/api', api);
