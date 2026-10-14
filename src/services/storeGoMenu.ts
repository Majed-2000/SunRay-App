/**
 * Live data for the Sun Ray Go (drive-thru) menu.
 *
 * Five public nodes, each a live listener as on the website, because each one
 * is flipped from the dashboard while customers may be looking:
 *
 * - `menu/products`               — the shared catalog (names, prices, photos)
 * - `menu/driveThru`              — which products Go sells, in what order
 * - `store/config/goMenu`         — the «being updated» switch and old daily hours
 * - `sunray/siteConfig/branches/go` — Go's weekly hours and emergency close
 * - `menu/sections/_new/order`    — the order of the «جديدنا» tab
 *
 * `menu/products` is the large one, and the main menu (`storeCatalog.ts`)
 * already listens to it. The Firebase client keeps one sync per path and fans
 * it out to every listener, so this second listener costs no second download.
 *
 * A failed read of the hours or the switch never closes the menu: closing is an
 * explicit decision on the dashboard, not the result of a network error. That
 * is the website's rule, and `goGate` relies on `branchReady` to keep it.
 */
import { onValue, ref } from 'firebase/database';
import { db } from './firebase';
import type { GoConfig, GoEntry, GoMenuInput, GoProduct } from '@/utils/goMenu';
import type { SiteBranch } from '@/utils/branchStatus';

export interface GoMenuState extends GoMenuInput {
  /** Both catalog nodes have arrived. Before that there is nothing to group. */
  ready: boolean;
  /** The catalog could not be read at all. */
  failed: boolean;
}

export function subscribeGoMenu(onChange: (s: GoMenuState) => void): () => void {
  const s: GoMenuState = {
    products: {},
    driveThru: {},
    config: null,
    branch: null,
    branchReady: false,
    newOrder: [],
    ready: false,
    failed: false,
  };
  let have = 0;
  const emit = () => onChange({ ...s });
  const asList = (v: unknown): string[] =>
    Array.isArray(v) ? v.map(String) : v && typeof v === 'object' ? Object.values(v).map(String) : [];

  const unsubs = [
    onValue(
      ref(db(), 'menu/products'),
      (snap) => {
        s.products = (snap.val() ?? {}) as Record<string, GoProduct>;
        have |= 1;
        s.ready = have === 3;
        emit();
      },
      () => {
        s.failed = true;
        emit();
      },
    ),
    onValue(
      ref(db(), 'menu/driveThru'),
      (snap) => {
        s.driveThru = (snap.val() ?? {}) as Record<string, GoEntry>;
        have |= 2;
        s.ready = have === 3;
        emit();
      },
      () => {
        s.failed = true;
        emit();
      },
    ),
    onValue(
      ref(db(), 'store/config/goMenu'),
      (snap) => {
        s.config = (snap.val() ?? null) as GoConfig | null;
        emit();
      },
      () => undefined,
    ),
    onValue(
      ref(db(), 'sunray/siteConfig/branches/go'),
      (snap) => {
        s.branch = (snap.val() ?? null) as Partial<SiteBranch> | null;
        s.branchReady = true;
        emit();
      },
      () => {
        s.branchReady = true;
        emit();
      },
    ),
    onValue(
      ref(db(), 'menu/sections/_new/order'),
      (snap) => {
        s.newOrder = asList(snap.val());
        emit();
      },
      () => undefined,
    ),
  ];
  return () => unsubs.forEach((u) => u());
}
