/**
 * The menu, read live from the store.
 *
 * The app used to render a hand-written menu from `src/data/menu.ts`, and later
 * a copy synced into our own Postgres. Both were wrong for the same reason, and
 * it is not tidiness: `store_payments.js` recomputes every order total from
 * THIS data on the server before charging anything. A price shown from any
 * other source is a price the server will not honour — the customer sees one
 * number, the card is charged another, or the order is rejected at settlement
 * with nothing to explain it.
 *
 * So the screen and the invoice now read the same rows.
 *
 * ## Shape
 *
 * `menu/products` is a map of serviceId → product, and `menu/categories` is a
 * map of section key → category. Money is in **halalas** throughout, matching
 * the rest of the system.
 *
 * A product is orderable only when `active !== false && purchasable === true`.
 * Both are required and they mean different things: `active` hides an item
 * everywhere, `purchasable` keeps it visible on the display menu while blocking
 * online orders — which is how the branch takes something off the app without
 * removing it from the wall.
 */
import { onValue, ref, off, type DataSnapshot } from 'firebase/database';
import { db } from './firebase';
import type { Category, Product } from '@/types';

/** Brewing method, when a product prices differently per method. */
export type BrewMethod = 'hot' | 'cold' | 'classic' | 'freddo';

/** A product exactly as the store stores it. */
interface RawProduct {
  id?: string;
  nameAr?: string;
  nameEn?: string;
  descAr?: string;
  descriptionAr?: string;
  section?: string;
  order?: number;
  active?: boolean;
  purchasable?: boolean;
  priceHalalas?: number | null;
  methodPriceHalalas?: Partial<Record<BrewMethod, number>> | null;
  img?: string | null;
  image?: string | null;
  emoji?: string | null;
}

interface RawCategory {
  nameAr?: string;
  nameEn?: string;
  emoji?: string | null;
  order?: number;
}

/**
 * Price in halalas for a product, honouring a per-method override.
 *
 * Mirrors `priceOf` in the store client. `null` means genuinely unpriced, which
 * is not the same as free — callers must not fall back to zero.
 */
export function priceHalalas(p: RawProduct, method?: BrewMethod): number | null {
  const viaMethod = method && p.methodPriceHalalas ? p.methodPriceHalalas[method] : null;
  const h = viaMethod != null ? viaMethod : p.priceHalalas;
  return h != null ? Number(h) : null;
}

/** Orderable in the app right now. */
function isPurchasable(p: RawProduct): boolean {
  return p.active !== false && p.purchasable === true;
}

function toProduct(id: string, p: RawProduct): Product | null {
  const h = priceHalalas(p);
  // An unpriced product cannot be put in a cart: the server would compute a
  // total the customer never agreed to. Drop it rather than show it as free.
  if (h == null) return null;
  return {
    id,
    foodicsId: p.id ?? id,
    nameAr: p.nameAr ?? id,
    nameEn: p.nameEn ?? '',
    descriptionAr: p.descriptionAr ?? p.descAr ?? '',
    descriptionEn: '',
    price: h / 100,
    image: p.img ?? p.image ?? null,
    emoji: p.emoji ?? '☕',
    categoryId: p.section ?? 'other',
    isAvailable: true,
    isFeatured: false,
    tags: [],
    sizes: [],
    addOns: [],
    rating: undefined,
  } as unknown as Product;
}

export interface CatalogSnapshot {
  products: Product[];
  categories: Category[];
}

/**
 * Subscribe to the live menu.
 *
 * `onValue` rather than a one-shot read: the branch closes sections and pulls
 * items during the day from the dashboard, and a customer holding a stale menu
 * orders something that is no longer being made.
 *
 * Returns an unsubscribe.
 */
export function subscribeCatalog(cb: (snap: CatalogSnapshot) => void): () => void {
  const database = db();
  const productsRef = ref(database, 'menu/products');
  const categoriesRef = ref(database, 'menu/categories');

  let rawProducts: Record<string, RawProduct> = {};
  let rawCategories: Record<string, RawCategory> = {};
  let seenProducts = false;

  const emit = () => {
    // Wait for products before the first emit, or the menu flashes empty while
    // only categories have arrived.
    if (!seenProducts) return;

    const products = Object.entries(rawProducts)
      .filter(([, p]) => p && isPurchasable(p))
      .map(([id, p]) => toProduct(id, p))
      .filter((p): p is Product => p !== null)
      .sort((a, b) => {
        const oa = rawProducts[a.id]?.order ?? 0;
        const ob = rawProducts[b.id]?.order ?? 0;
        return oa - ob;
      });

    // Only sections that actually have something orderable in them. An empty
    // category tab that shows "no items" reads as a broken filter.
    const used = new Set(products.map((p) => p.categoryId));
    const categories: Category[] = Object.entries(rawCategories)
      .filter(([key]) => used.has(key))
      .sort((a, b) => (a[1]?.order ?? 0) - (b[1]?.order ?? 0))
      .map(([key, c]) => ({
        id: key,
        foodicsId: key,
        nameAr: c?.nameAr ?? key,
        nameEn: c?.nameEn ?? '',
        emoji: c?.emoji ?? '',
      }));

    cb({ products, categories });
  };

  const onProducts = (s: DataSnapshot) => {
    rawProducts = (s.val() as Record<string, RawProduct>) || {};
    seenProducts = true;
    emit();
  };
  const onCategories = (s: DataSnapshot) => {
    rawCategories = (s.val() as Record<string, RawCategory>) || {};
    emit();
  };

  onValue(productsRef, onProducts);
  onValue(categoriesRef, onCategories);

  return () => {
    off(productsRef, 'value', onProducts);
    off(categoriesRef, 'value', onCategories);
  };
}
