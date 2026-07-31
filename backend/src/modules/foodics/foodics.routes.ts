/**
 * Foodics operational endpoints.
 *
 * Everything here is guarded by `requireDev` — hidden (404) in production unless
 * ADMIN_ENABLED=true. These are operator tools, not customer-facing API.
 *
 * Note there is deliberately NO order-injection endpoint yet. Writing to Foodics
 * puts a real ticket in front of real staff at the counter, and the branch is
 * not ready for it (see /foodics/status → readiness).
 */
import { Router } from 'express';
import { requireDev } from '../../middleware/requireSelf';
import { ok } from '../../common/response';
import { env } from '../../config/env';
import { foodics } from './foodics.client';
import { syncFoodicsMenu } from './foodics.sync';

export const foodicsRouter = Router();

foodicsRouter.use(requireDev);

/**
 * Token identity, granted scopes, and a readiness assessment.
 * Read-only and cheap — the first thing to call when something looks wrong.
 */
foodicsRouter.get('/status', async (_req, res, next) => {
  try {
    if (!foodics.configured) {
      return ok(res, { configured: false, message: 'FOODICS_TOKEN is not set' });
    }

    const who = await foodics.whoami<{
      business: { id: string; name: string; reference: number };
      user: { name: string; email: string };
      scopes: string[];
    }>();
    const scopes = who.data.scopes ?? [];

    // Scopes actually needed per docs/FOODICS_INTEGRATION_PLAN.md. `orders.get`
    // is satisfied by `orders.limited.read`, and `customers.get` by
    // `customers.list` plus a filter, so both are treated as alternatives.
    const required: Array<{ scope: string; alt?: string; purpose: string }> = [
      { scope: 'general.read', purpose: 'menu, branches, taxes' },
      { scope: 'orders.limited.create', alt: 'orders.write', purpose: 'inject orders' },
      { scope: 'orders.list', purpose: 'reconcile orders' },
      { scope: 'orders.limited.read', alt: 'orders.get', purpose: 'read one order' },
      { scope: 'customers.list', purpose: 'find customer by phone' },
      { scope: 'customers.write', purpose: 'create/update customer' },
      { scope: 'orders.gift_cards.read', purpose: 'gift card balance' },
      { scope: 'orders.gift_cards.write', purpose: 'gift card transactions' },
      { scope: 'coupons.write', alt: undefined, purpose: 'issue loyalty reward (Path A)' },
    ];
    const missing = required.filter((r) => !scopes.includes(r.scope) && !(r.alt && scopes.includes(r.alt)));

    return ok(res, {
        configured: true,
        business: who.data.business,
        user: who.data.user,
        scopes,
        missing,
        orderInjectionEnabled: env.FOODICS_ORDER_INJECTION,
        branchId: env.FOODICS_BRANCH_ID || null,
      });
  } catch (err) {
    return next(err);
  }
});

/**
 * Pull menu, categories and branches from Foodics into our database.
 * Read-only against Foodics; safe to run against production.
 *
 * ⚠️ Do not run this while serving live order traffic. A bulk scan once
 * exhausted the rate-limit quota and delayed a real customer order by 13s.
 */
foodicsRouter.post('/sync', async (_req, res, next) => {
  try {
    const report = await syncFoodicsMenu();
    return ok(res, report);
  } catch (err) {
    return next(err);
  }
});
