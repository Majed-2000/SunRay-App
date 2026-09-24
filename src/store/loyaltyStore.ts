import { create } from 'zustand';
import { fetchMyLoyalty, type LoyaltyEvent, type LoyaltyReward, type MyLoyalty } from '@/services/storeLoyalty';

/** Stable empty fallbacks — see the note on `rewards` below. */
const NO_REWARDS: LoyaltyReward[] = [];
const NO_EVENTS: LoyaltyEvent[] = [];

/**
 * The customer's loyalty state, mirrored from the live ledger.
 *
 * Nothing here is computed locally and nothing is invented. The previous
 * version opened with `points: 140`, `visits: 8`, `cupCount: 4` and a
 * "buy 6 get the 7th free" card — none of which existed. The real programme is
 * one point per riyal, migrated 1:1 from Boonus for 19,279 customers, so a
 * customer with 2,546 real points was shown "4 of 6 cups".
 *
 * ## Why there is no `earn`, `spend` or `redeem` here
 *
 * The balance is the server's. Points are awarded when an order settles, and a
 * reward is taken by adding it to the cart at price zero — `createStoreOrder`
 * performs the deduction as it writes the order. A local `spend()` would move a
 * number on this device that the ledger never agreed to, and the next refresh
 * would silently undo it. The old store did exactly that.
 *
 * The screens' job is to display and to refresh.
 */
interface LoyaltyState {
  /** Live snapshot, or null before the first load / when signed out. */
  data: MyLoyalty | null;
  status: 'idle' | 'loading' | 'ready' | 'error';
  /** True when this account has no phone the ledger recognises. */
  unlinked: boolean;

  load: () => Promise<void>;

  // ── Derived reads. All tolerate `data === null`. ──
  points: () => number;
  visits: () => number;
  /**
   * Points still needed for the next reward, or **null** when the threshold is
   * unknown. Null is a real answer and must stay null: the server withholds the
   * threshold until an admin confirms it, because showing a goal derived from a
   * guess is a promise the customer reads as a commitment.
   */
  pointsToNextReward: () => number | null;
  rewardLabel: () => string;
  /** Reward ladder with real products, each flagged affordable or not. */
  rewards: () => LoyaltyReward[];
  timeline: () => LoyaltyEvent[];
  /** Tier as the server computed it, or null when tiers are switched off. */
  tierLabel: () => string | null;
}

export const useLoyaltyStore = create<LoyaltyState>((set, get) => ({
  data: null,
  status: 'idle',
  unlinked: false,

  load: async () => {
    set({ status: 'loading' });
    const res = await fetchMyLoyalty();
    if (!res) {
      set({ status: 'error' });
      return;
    }
    // `linked: false` is not a failure — it is a customer the ledger does not
    // know yet. Rendering that as a zero balance would tell someone who has
    // been buying coffee for a year that they have never earned anything.
    set({ data: res, status: 'ready', unlinked: res.linked === false });
  },

  points: () => get().data?.balance ?? 0,
  visits: () => get().data?.visits ?? 0,

  pointsToNextReward: () => {
    const d = get().data;
    if (!d || !d.thresholdConfirmed || d.threshold == null) return null;
    return Math.max(0, d.threshold - d.balance);
  },

  rewardLabel: () => get().data?.rewardLabel ?? 'مكافأة',
  /**
   * ⚠️ The fallbacks are shared frozen constants, not `?? []`.
   *
   * A fresh `[]` is a fresh identity, and Zustand compares selector results with
   * `Object.is`. Written as `?? []`, every render while `data` is null produced
   * a "new" value, scheduled another render, and looped — the same defect that
   * took the app down from `giftAmounts`. One constant compares equal to itself.
   */
  rewards: () => get().data?.rewards ?? NO_REWARDS,
  timeline: () => get().data?.timeline ?? NO_EVENTS,
  tierLabel: () => get().data?.tier?.label ?? null,
}));
