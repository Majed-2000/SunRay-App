import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { deviceStorage, PERSIST_VERSION } from './persistStorage';

/** How long a pager stays in «طلباتك الحالية» — the website's 12 hours. */
export const PAGER_TTL_MS = 12 * 60 * 60 * 1000;
/** The site keeps three; more than that is old orders, not current ones. */
const MAX_ACTIVE = 3;

export interface ActivePager {
  /** Order id from the server — one entry per order. */
  pid: string;
  number?: string;
  /** Session from `pagerOpen`/`pagerFollow`; reopening needs only this. */
  s: string;
  /** The cashier token, kept to open a fresh session if `s` is refused. */
  t?: string;
  at: number;
  /** Highest «ready» call already rung for, so a reopen does not ring again. */
  alertedSeq?: number;
}

interface PagerState {
  active: ActivePager[];
  /** Add or refresh an order the customer is following. */
  remember: (entry: Omit<ActivePager, 'at' | 'alertedSeq'>) => void;
  /** Drop an order that was collected, closed or expired. */
  forget: (pid: string) => void;
  /** Saved session for a cashier token, if this device already opened it. */
  sessionForToken: (t: string) => string | undefined;
  markAlerted: (pid: string, seq: number) => void;
  alertedSeq: (pid: string) => number;
}

const fresh = (list: ActivePager[]) => list.filter((x) => x && Date.now() - x.at < PAGER_TTL_MS);

/**
 * Pagers this device is following — the website's `sr_pg_active`.
 *
 * A customer who leaves the pager screen (or the app) must be able to get
 * back to their order without asking the cashier for the QR again, so live
 * sessions are kept on the device for 12 hours and listed on the scan
 * screen. A session is only a capability to read one order's status; it is
 * not an account credential, and nothing here is a source of truth — the
 * stage is always re-read from the server.
 */
export const usePagerStore = create<PagerState>()(
  persist(
    (set, get) => ({
      active: [],
      remember: (entry) =>
        set((st) => {
          const prev = st.active.find((x) => x.pid === entry.pid);
          const rest = fresh(st.active).filter((x) => x.pid !== entry.pid);
          const next: ActivePager = {
            ...prev,
            ...entry,
            t: entry.t ?? prev?.t,
            at: Date.now(),
          };
          return { active: [next, ...rest].slice(0, MAX_ACTIVE) };
        }),
      forget: (pid) => set((st) => ({ active: st.active.filter((x) => x.pid !== pid) })),
      sessionForToken: (t) => fresh(get().active).find((x) => x.t === t)?.s,
      markAlerted: (pid, seq) =>
        set((st) => ({ active: st.active.map((x) => (x.pid === pid ? { ...x, alertedSeq: seq } : x)) })),
      alertedSeq: (pid) => get().active.find((x) => x.pid === pid)?.alertedSeq ?? 0,
    }),
    {
      name: 'sunray.pager',
      version: PERSIST_VERSION,
      storage: deviceStorage,
      partialize: (s) => ({ active: s.active }),
      // Expired entries are dropped on load so the list never offers a dead one.
      onRehydrateStorage: () => (state) => {
        if (state) usePagerStore.setState({ active: fresh(state.active) });
      },
    },
  ),
);

/** Live entries only — the list screens show. */
export function activePagers(list: ActivePager[]): ActivePager[] {
  return fresh(list);
}
