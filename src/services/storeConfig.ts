/**
 * Business settings, read from the store rather than compiled into the app.
 *
 * These used to be literals in `src/constants/config.ts` — a 15% VAT rate, a
 * 15 ﷼ delivery fee, a 120 ﷼ free-delivery threshold, gift amounts of 50/100/300.
 * Every one of them is a number the business changes without shipping an app,
 * and a shipped copy goes stale silently: the customer is quoted a fee the
 * server does not charge, or offered a gift amount that no longer exists.
 *
 * `store/config` is world-readable by design (see `database.rules.json`), which
 * is why it holds settings and never anything sensitive — refund approvers, for
 * instance, are stored by employee number precisely because the phone must stay
 * server-side.
 *
 * ## These values are advisory
 *
 * The server recomputes every total from the catalog before charging. What is
 * read here is for *display* — so the customer sees the same fee they will be
 * charged — never for deciding what to charge.
 */
import { onValue, ref, off, type DataSnapshot } from 'firebase/database';
import { db } from './firebase';

/** Whether the store is accepting orders right now, and why not. */
export interface OpenState {
  open: boolean;
  /** Arabic reason shown when closed — prayer, Friday, maintenance. */
  reason: string | null;
}

/** One gift package as configured by the branch. */
export interface GiftPackage {
  id: string;
  nameAr: string;
  priceSar: number;
  active: boolean;
}

export interface StoreSettings {
  /** Sections the branch has closed for now (breakfast ended, etc.). */
  closedSections: Record<string, boolean>;
  giftPackages: GiftPackage[];
}

/**
 * Subscribe to store open/closed.
 *
 * `store_hours` closes the store automatically for Taif prayer times, Friday,
 * and maintenance windows. A customer who builds a cart while the store is shut
 * gets refused at checkout, so this needs to be live rather than fetched once.
 */
export function subscribeOpenState(cb: (s: OpenState) => void): () => void {
  const r = ref(db(), 'store/config/open');
  const handler = (snap: DataSnapshot) => {
    const v = snap.val();
    // A bare boolean and an object both appear in this node depending on how
    // it was last written from the dashboard.
    if (typeof v === 'boolean') return cb({ open: v, reason: null });
    cb({
      open: v?.open !== false,
      reason: typeof v?.reason === 'string' ? v.reason : null,
    });
  };
  onValue(r, handler);
  return () => off(r, 'value', handler);
}

/** Subscribe to gift packages and closed sections. */
export function subscribeSettings(cb: (s: StoreSettings) => void): () => void {
  const database = db();
  const packagesRef = ref(database, 'store/config/giftPackages');
  const sectionsRef = ref(database, 'store/config/closedSections');

  let giftPackages: GiftPackage[] = [];
  let closedSections: Record<string, boolean> = {};

  const emit = () => cb({ giftPackages, closedSections });

  const onPackages = (s: DataSnapshot) => {
    const raw = (s.val() as Record<string, { nameAr?: string; priceSar?: number; active?: boolean }>) || {};
    giftPackages = Object.entries(raw)
      // `active === false` is a deliberate switch-off, not a missing field.
      .filter(([, p]) => p && p.active !== false && Number(p.priceSar) > 0)
      .map(([id, p]) => ({
        id,
        nameAr: p.nameAr ?? id,
        priceSar: Number(p.priceSar),
        active: true,
      }))
      .sort((a, b) => a.priceSar - b.priceSar);
    emit();
  };

  const onSections = (s: DataSnapshot) => {
    closedSections = (s.val() as Record<string, boolean>) || {};
    emit();
  };

  onValue(packagesRef, onPackages);
  onValue(sectionsRef, onSections);

  return () => {
    off(packagesRef, 'value', onPackages);
    off(sectionsRef, 'value', onSections);
  };
}
