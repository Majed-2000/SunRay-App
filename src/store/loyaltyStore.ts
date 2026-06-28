import { create } from 'zustand';
import type { LoyaltyTier, Reward } from '@/types';
import { CONFIG } from '@/constants/config';
import { toast } from './uiStore';
import { useWalletStore } from './walletStore';

interface LoyaltyState {
  points: number; // redeemable balance
  lifetimePoints: number; // for tier
  visits: number;
  /**
   * Path A cup counter ("buy 6 coffees → 7th free"). In production OUR BACKEND
   * owns this counter (incremented from `customer.order.created` webhooks) and
   * issues the free coffee as a Foodics Coupon. Loyalty requires the customer
   * phone as identity. Here it is mocked locally.
   */
  cupCount: number;
  earn: (points: number) => void;
  /** Add eligible coffee cups (mock for the backend counter). */
  addCups: (count: number) => void;
  freeCoffeeReady: () => boolean;
  cupsToFreeCoffee: () => number;
  /** Redeem the free-coffee reward → returns a mock coupon code (or null). */
  redeemFreeCoffee: () => string | null;
  /** Redeem a catalog reward. Returns true on success. */
  redeem: (reward: Reward) => boolean;
  /** Spend raw points (cart redemption). Returns true on success. */
  spend: (points: number) => boolean;
  tier: () => LoyaltyTier;
  pointsToNextDrink: () => number;
}

function tierFor(lifetime: number): LoyaltyTier {
  if (lifetime >= CONFIG.TIER_THRESHOLDS.gold) return 'gold';
  if (lifetime >= CONFIG.TIER_THRESHOLDS.silver) return 'silver';
  return 'bronze';
}

export const useLoyaltyStore = create<LoyaltyState>((set, get) => ({
  points: 140,
  lifetimePoints: 1620,
  visits: 8,
  cupCount: 4,

  earn: (points) =>
    set((s) => ({
      points: s.points + points,
      lifetimePoints: s.lifetimePoints + points,
      visits: s.visits + 1,
    })),

  addCups: (count) => {
    if (count <= 0) return;
    set((s) => ({ cupCount: s.cupCount + count }));
  },

  freeCoffeeReady: () => get().cupCount >= CONFIG.LOYALTY_CUP_GOAL,
  cupsToFreeCoffee: () => Math.max(0, CONFIG.LOYALTY_CUP_GOAL - get().cupCount),

  redeemFreeCoffee: () => {
    if (get().cupCount < CONFIG.LOYALTY_CUP_GOAL) {
      toast(`تبقّى ${CONFIG.LOYALTY_CUP_GOAL - get().cupCount} أكواب لقهوتك المجانية`);
      return null;
    }
    set((s) => ({ cupCount: s.cupCount - CONFIG.LOYALTY_CUP_GOAL }));
    // In production the backend issues a Foodics Coupon and returns its code.
    const code = `SR-FREE-${Math.floor(1000 + Math.random() * 9000)}`;
    toast('قهوتك المجانية جاهزة 🎉');
    return code;
  },

  redeem: (reward) => {
    if (get().points < reward.cost) {
      toast('نقاطك غير كافية');
      return false;
    }
    set((s) => ({ points: s.points - reward.cost }));
    if (reward.kind === 'walletTopup' && reward.value) {
      useWalletStore.getState().credit(reward.value, 'استبدال نقاط ولاء', 'reward');
      toast('تم شحن محفظتك 🎉');
    } else {
      toast('تم الاستبدال 🎉');
    }
    return true;
  },

  spend: (points) => {
    if (points <= 0 || get().points < points) return false;
    set((s) => ({ points: s.points - points }));
    return true;
  },

  tier: () => tierFor(get().lifetimePoints),
  pointsToNextDrink: () => Math.max(0, CONFIG.FREE_DRINK_AT - get().points),
}));
