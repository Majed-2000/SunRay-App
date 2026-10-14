import { create } from 'zustand';
import {
  subscribeOpenState,
  subscribeSettings,
  type GiftPackage,
  type OpenState,
} from '@/services/storeConfig';

/**
 * Live business settings from `store/config`.
 *
 * These were literals in the app: gift amounts of 50/100/300, a 15 ﷼ delivery
 * fee, and no notion of the store being closed at all. Each is something the
 * branch changes during the day — a section sells out, prayer time closes
 * ordering, a gift package is retired — and a compiled-in copy is wrong
 * silently rather than loudly.
 *
 * Subscriptions rather than one-shot reads, for the same reason: a customer who
 * opened the app before Maghrib and checked out after would otherwise be
 * refused at the till with no explanation on screen.
 */
interface StoreSettingsState {
  open: boolean;
  /** Arabic reason when closed — prayer, Friday, maintenance. */
  closedReason: string | null;
  giftPackages: GiftPackage[];
  /**
   * Amounts offered for a gift card, cheapest first.
   *
   * Stored, not derived on read. It began as `giftAmounts: () => packages.map(…)`
   * and screens selected it with `useStoreSettingsStore((s) => s.giftAmounts())`.
   * Zustand compares a selector's result with `Object.is`, and `.map()` returns a
   * new array every call — so the result never compared equal, every render
   * scheduled another, and the app died with "Maximum update depth exceeded" the
   * moment the home screen mounted.
   *
   * Computed once here when the packages change, the reference is stable and the
   * comparison does its job.
   */
  giftAmounts: number[];
  closedSections: Record<string, boolean>;
  /** False until the first snapshot lands. */
  ready: boolean;

  /** Start listening. Returns an unsubscribe; safe to call once at app start. */
  start: () => () => void;
  isSectionClosed: (section: string) => boolean;
}

export const useStoreSettingsStore = create<StoreSettingsState>((set, get) => ({
  // Optimistic default: assume open, and let the store correct us. Starting
  // closed would show "we're shut" for a beat on every cold start.
  open: true,
  closedReason: null,
  giftPackages: [],
  giftAmounts: [],
  closedSections: {},
  ready: false,

  start: () => {
    const stopOpen = subscribeOpenState((s: OpenState) =>
      set({ open: s.open, closedReason: s.reason }),
    );
    const stopSettings = subscribeSettings((s) =>
      set({
        giftPackages: s.giftPackages,
        giftAmounts: s.giftPackages.map((p) => p.priceSar),
        closedSections: s.closedSections,
        ready: true,
      }),
    );
    return () => {
      stopOpen();
      stopSettings();
    };
  },

  isSectionClosed: (section) => get().closedSections[section] === true,
}));
