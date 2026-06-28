/**
 * Loyalty service interface — Path A (`.claude/FOODICS_API.md §10`).
 *
 * IMPORTANT: OUR backend is the source of truth for cup counters. Foodics'
 * built-in loyalty is AMOUNT-based (currency), NOT count-based, so it cannot
 * count "cups" — we must not rely on it for "buy 6 coffees, get the 7th free".
 *
 * Flow: the backend listens to `customer.order.created` webhooks, increments the
 * customer's coffee counter, and when it reaches the goal it issues a reward as
 * a Foodics COUPON (free coffee) that the cashier applies. Loyalty REQUIRES the
 * customer phone as identity.
 */
import { request } from './api';
import type { LoyaltyCounter, LoyaltyReward } from './foodics.types';

/** GET /api/loyalty?phone=... — current cup counter for a customer. */
export async function getLoyaltyCounter(phone: string): Promise<LoyaltyCounter> {
  return request<LoyaltyCounter>('/api/loyalty', { query: { phone } });
}

/** GET /api/loyalty/rewards?phone=... — issued (unredeemed) rewards. */
export async function listRewards(phone: string): Promise<LoyaltyReward[]> {
  return request<LoyaltyReward[]>('/api/loyalty/rewards', { query: { phone } });
}

/**
 * POST /api/loyalty/redeem — redeem available points/reward. The backend creates
 * (or marks) the reward/coupon and returns it for the cashier to apply.
 */
export async function redeemReward(phone: string, rewardId?: string): Promise<LoyaltyReward> {
  return request<LoyaltyReward>('/api/loyalty/redeem', {
    method: 'POST',
    body: { phone, rewardId },
  });
}
