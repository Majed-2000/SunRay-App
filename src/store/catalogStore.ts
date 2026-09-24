import { create } from 'zustand';
import type { Category, Product } from '@/types';
import { subscribeCatalog } from '@/services/storeCatalog';

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
    try {
      unsubscribe = subscribeCatalog(({ products, categories }) => {
        set({ products, categories, status: 'ready', error: null });
      });
    } catch (e) {
      set({ status: 'error', error: e instanceof Error ? e.message : 'تعذّر تحميل القائمة' });
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
