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

export const rootRouter = Router();

// Health check at the root.
rootRouter.use('/health', healthRouter);

// Everything else under /api.
const api = Router();
api.use('/auth', authRouter);
api.use('/branches', branchesRouter);
api.use('/menu', menuRouter);
api.use('/products', productsRouter);
api.use('/orders', ordersRouter);
api.use('/gift-cards', giftCardsRouter);

// Customer-scoped routers (more specific → registered first).
api.use('/customers/:id/wallet', walletRouter);
api.use('/customers/:id/loyalty', loyaltyRouter);
api.use('/customers/:id/notifications', notificationsRouter);
api.use('/customers/:id/gift-cards', customerGiftCardsRouter);
api.use('/customers', customersRouter);

rootRouter.use('/api', api);
