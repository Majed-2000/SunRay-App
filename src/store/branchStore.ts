import { create } from 'zustand';
import type { Branch } from '@/types';
import { subscribeOpenState } from '@/services/storeConfig';

/**
 * The branch.
 *
 * Singular, deliberately. Sun Ray runs **one** branch — الحلقة الغربية — and
 * the store treats it as a constant rather than a collection: `store-gate.js`
 * hardcodes `{ name: "الحلقة", lat, lng }` and the server keeps the same pair
 * as its arrival-geofence fallback. There is no branches table to read.
 *
 * The app previously carried a mock array of several branches with a picker and
 * a "nearest branch" mode, left over from an earlier season when a second
 * branch existed. Offering a choice of one is noise; offering a choice that
 * includes a closed seasonal branch is worse.
 *
 * What IS live is whether the branch is accepting orders: `store_hours` closes
 * it automatically for Taif prayer times, Friday, and maintenance. That is
 * subscribed, not fetched, because it changes while a customer is mid-cart.
 *
 * The shape stays an array so the screens that map over `branches` keep working.
 */

/**
 * Coordinates match `ARRIVE_BRANCH_FALLBACK` in `store_payments.js` and
 * `BRANCH` in `store-gate.js`. The server can override the arrival centre from
 * `store/config/arrival`; this copy is only for showing the branch on a map.
 */
const HALQA: Branch = {
  id: 'halqa',
  foodicsId: '',
  nameAr: 'الحلقة الغربية',
  nameEn: 'Al Halqa',
  areaAr: 'الطائف',
  addressAr: 'الحلقة الغربية، الطائف',
  lat: 21.3425149,
  lng: 40.4401308,
  isOpen: true,
  hoursAr: '',
  openingFrom: '',
  openingTo: '',
  distanceKm: 0,
  supportsDelivery: false,
  supportsDineIn: false,
};

type Status = 'idle' | 'loading' | 'ready' | 'error';

interface BranchState {
  branches: Branch[];
  selectedBranchId: string;
  auto: boolean;
  status: Status;
  error: string | null;
  /** Arabic reason when closed — prayer, Friday, maintenance. */
  closedReason: string | null;
  load: () => Promise<void>;
  selectBranch: (id: string) => void;
  selectNearest: () => void;
  current: () => Branch;
}

/** Live subscription handle, kept out of state so it is never rendered. */
let unsubscribe: (() => void) | null = null;

export const useBranchStore = create<BranchState>((set, get) => ({
  branches: [HALQA],
  selectedBranchId: HALQA.id,
  auto: true,
  status: 'ready',
  error: null,
  closedReason: null,

  load: async () => {
    if (unsubscribe) return;
    unsubscribe = subscribeOpenState(({ open, reason }) => {
      const s = get();
      // Rebuild the branch objects only when the state actually changed.
      // `.map()` unconditionally would hand every screen selecting `current()`
      // a new object identity on each emission and re-render them for nothing.
      if (s.branches[0]?.isOpen === open && s.closedReason === reason) return;
      set({
        branches: s.branches.map((b) => ({ ...b, isOpen: open })),
        closedReason: reason,
        status: 'ready',
      });
    });
  },

  // Kept so existing callers (the branch picker sheet) still compile. With one
  // branch there is nothing to choose, and both resolve to the same place.
  selectBranch: (id) => set({ selectedBranchId: id, auto: false }),
  selectNearest: () => set({ selectedBranchId: HALQA.id, auto: true }),

  current: () => {
    const { branches, selectedBranchId } = get();
    return branches.find((b) => b.id === selectedBranchId) ?? branches[0];
  },
}));
