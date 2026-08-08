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

/**
 * A product exactly as the store stores it.
 *
 * ⚠️ Field names taken from the store client (`store-catalog.js`), not guessed.
 * The Arabic name is `name`, NOT `nameAr` — an earlier version assumed `nameAr`
 * and every card fell back to the RTDB key, so the menu read
 * "Augustino_e", "cod_small", "es_col_mango". The description is `desc`.
 */
interface RawProduct {
  id?: string;
  /** Arabic name. The primary label. */
  name?: string;
  nameEn?: string;
  /** Arabic description. */
  desc?: string;
  section?: string;
  order?: number;
  active?: boolean;
  purchasable?: boolean;
  priceHalalas?: number | null;
  methodPriceHalalas?: Partial<Record<BrewMethod, number>> | null;
  image?: string | null;
}

/**
 * Section key → the category the customer sees, mirroring `storeCatOf` in the
 * store client.
 *
 * Categories are NOT a lookup of `menu/categories` by section: several sections
 * collapse into one customer-facing group (hot, cold and winter drinks are all
 * «المشروبات»), and «قهوة اليوم» is picked out by product id rather than by
 * section at all. Reading `menu/categories` and matching on `section` — which
 * is what this did first — produced no matching keys, so the menu showed a
 * single «الكل» chip and no way to filter 111 products.
 */
const SECTION_CATEGORY: Record<string, string> = {
  pouroverSection: 'القهوة المقطرة',
  beans_espresso_premium: 'إسبريسو',
  beans_espresso_classic: 'إسبريسو',
  matchaSection: 'ماتشا',
  healthyBreakfast: 'الفطور الصحي',
  hotDrinks: 'المشروبات',
  coldDrinks: 'المشروبات',
  winterItems: 'المشروبات',
  desserts: 'الحلويات',
  miniMenu: 'الحلويات',
};

/** Display order of the sections, from the store client's SECTION_RANK. */
const SECTION_RANK: Record<string, number> = {
  pouroverSection: 1,
  beans_espresso_premium: 2,
  beans_espresso_classic: 3,
  matchaSection: 4,
  healthyBreakfast: 5,
  hotDrinks: 7,
  winterItems: 7,
  coldDrinks: 8,
  desserts: 9,
  miniMenu: 10,
  extras: 11,
};

const DEFAULT_CATEGORY = 'محاصيلنا & إضافات';

/** Category label for a product — `storeCatOf`, ported. */
function categoryOf(id: string, p: RawProduct): string {
  // Coffee of the Day is identified by id, not by its section.
  if (id === 'cod_small' || id === 'cod_large') return 'قهوة اليوم';
  return SECTION_CATEGORY[p.section ?? ''] ?? DEFAULT_CATEGORY;
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
    // `name`, not `nameAr`. Falling back to the key here is what put
    // "es_col_mango" on a menu card.
    nameAr: p.name ?? p.nameEn ?? id,
    nameEn: p.nameEn ?? '',
    descriptionAr: p.desc ?? '',
    descriptionEn: '',
    price: h / 100,
    image: p.image ?? null,
    emoji: '☕',
    categoryId: categoryOf(id, p),
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

  const onProducts = (s: DataSnapshot) => {
    const raw = (s.val() as Record<string, RawProduct>) || {};

    const entries = Object.entries(raw).filter(([, p]) => p && isPurchasable(p));

    const products = entries
      .map(([id, p]) => toProduct(id, p))
      .filter((p): p is Product => p !== null)
      // Section rank first, then the product's own order — the same ordering
      // the store's own menu uses, so the app doesn't present a different one.
      .sort((a, b) => {
        const pa = raw[a.id];
        const pb = raw[b.id];
        const ra = SECTION_RANK[pa?.section ?? ''] ?? 99;
        const rb = SECTION_RANK[pb?.section ?? ''] ?? 99;
        return ra - rb || (pa?.order ?? 0) - (pb?.order ?? 0);
      });

    /**
     * Categories are derived from the products present, in the order those
     * products appear — not read from `menu/categories`.
     *
     * Only groups that actually contain something orderable get a chip, so a
     * tab can never open onto "no items".
     */
    const seen = new Set<string>();
    const categories: Category[] = [];
    for (const p of products) {
      if (seen.has(p.categoryId)) continue;
      seen.add(p.categoryId);
      categories.push({
        id: p.categoryId,
        foodicsId: p.categoryId,
        nameAr: p.categoryId,
        nameEn: '',
        emoji: '',
      });
    }

    cb({ products, categories });
  };

  onValue(productsRef, onProducts);
  return () => off(productsRef, 'value', onProducts);
}
