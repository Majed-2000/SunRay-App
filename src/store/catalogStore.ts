import { create } from 'zustand';
import type { Category, Product } from '@/types';
import { subscribeCatalog, type CatalogProduct } from '@/services/storeCatalog';
import { useStoreSettingsStore } from './storeSettingsStore';

/**
 * The menu.
 *
 * Live, this mirrors `menu/products` and `menu/categories` from the store —
 * the very rows `store_payments.js` recomputes each order total from before
 * charging. That is why it cannot come from anywhere else: a price rendered
 * from a second source is a price the server will not honour, so the customer
 * is shown one number and charged another, or the order is rejected at
 * settlement with nothing to explain it.
 *
 * It **subscribes** rather than fetching once. The branch pulls items and
 * closes sections through the day, and a customer holding a menu from twenty
 * minutes ago orders something no longer being made.
 */
type Status = 'idle' | 'loading' | 'ready' | 'error';

interface CatalogState {
  categories: Category[];
  products: Product[];
  status: Status;
  error: string | null;
  /** Begins (or restarts) the live subscription. Idempotent. */
  load: () => Promise<void>;
  fetchProduct: (id: string) => Promise<Product | null>;
  productById: (id: string) => Product | undefined;
  featured: () => Product[];
  byCategory: (categoryId: string) => Product[];
}

/** Live subscription handle, kept outside state so it is never rendered. */
let unsubscribe: (() => void) | null = null;

/** The menu as the store sent it, before closed sections are applied. */
let liveProducts: CatalogProduct[] = [];

/**
 * How long to wait for the first snapshot before calling it an error.
 *
 * The RTDB client has no offline cache here, so a device that starts offline
 * simply waits — and the menu sat on its skeleton with no way out.
 */
const FIRST_SNAPSHOT_TIMEOUT_MS = 15_000;

/**
 * Mark products in a section the branch has closed (breakfast ended, etc.) as
 * unavailable. They stay on the menu like a sold-out item, and every existing
 * `isAvailable` check — the row, quick add, the product screen, the cart
 * re-sync — then refuses them. Unchanged products keep their identity so the
 * memoised rows do not all re-render.
 */
function applyClosedSections(products: CatalogProduct[], closed: Record<string, boolean>): Product[] {
  return products.map((p) =>
    p.isAvailable && p.section && closed[p.section] === true ? { ...p, isAvailable: false } : p,
  );
}

export const useCatalogStore = create<CatalogState>((set, get) => ({
  // In mock mode we start ready with mock data (no loading flash). In backend
  // mode we start empty + loading and fetch on app start.
  categories: [],
  products: [],
  status: 'loading',
  error: null,

  load: async () => {
    // Already listening — the data is live, so re-subscribing would only churn.
    if (unsubscribe) return;
    set({ status: 'loading', error: null });

    // Drop the listener on failure so the retry on ErrorState really
    // resubscribes — the `if (unsubscribe) return` above made it a no-op.
    const fail = (message: string) => {
      clearTimeout(timer);
      const stop = unsubscribe;
      unsubscribe = null;
      stop?.();
      set({ status: 'error', error: message });
    };
    const timer = setTimeout(() => {
      if (get().status === 'loading') fail('تعذّر الاتصال — تحقّق من الإنترنت وحاول مجددًا');
    }, FIRST_SNAPSHOT_TIMEOUT_MS);

    try {
      const stop = subscribeCatalog(
        ({ products, categories }) => {
          clearTimeout(timer);
          liveProducts = products;
          const closed = useStoreSettingsStore.getState().closedSections;
          set({ products: applyClosedSections(products, closed), categories, status: 'ready', error: null });
        },
        () => fail('تعذّر تحميل القائمة'),
      );
      // A refusal reported before this line would otherwise leave a dead
      // handle behind that blocks every retry.
      if (get().status === 'error') stop();
      else unsubscribe = stop;
    } catch (e) {
      fail(e instanceof Error ? e.message : 'تعذّر تحميل القائمة');
    }
  },

  /**
   * Products are already in memory from the live subscription, so there is no
   * per-product fetch. A miss means the item is genuinely not on the menu right
   * now — pulled or sold out — and callers should treat null as that.
   */
  fetchProduct: async (id) => get().productById(id) ?? null,

  productById: (id) => get().products.find((p) => p.id === id),
  featured: () => get().products.filter((p) => p.isFeatured),
  byCategory: (categoryId) => get().products.filter((p) => p.categoryId === categoryId),
}));

// Closed sections change independently of the menu, so re-apply them when they
// do. The cart's re-sync follows the resulting `products` change and drops
// lines from a section that just closed.
useStoreSettingsStore.subscribe((settings, prev) => {
  if (settings.closedSections === prev.closedSections) return;
  if (useCatalogStore.getState().status !== 'ready') return;
  useCatalogStore.setState({ products: applyClosedSections(liveProducts, settings.closedSections) });
});
