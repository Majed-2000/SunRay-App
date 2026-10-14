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
import type { BrewMethod, Category, Product, ProductMethod } from '@/types';
import type { IconName } from '@/components/icons/glyphs';

export type { BrewMethod };

/** Display order and Arabic label of each brewing method. */
const METHOD_LABELS: [BrewMethod, string][] = [
  ['hot', 'حار'],
  ['cold', 'بارد'],
  ['classic', 'كلاسيك'],
  ['freddo', 'فريدو'],
];

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
  /**
   * Stock from the Foodics sync. Only tracked items carry it (desserts, bags
   * of beans); 0 means none left today.
   */
  fxQty?: number | null;
  /** Set when the item was marked sold out — by staff or by the Foodics sync. */
  soldout_by?: unknown;
  soldoutSource?: string | null;
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

/**
 * The brand icon for a product, from where the store files it.
 *
 * Shown when a product has no photo (7 of 98 today) and beside each category.
 * Every product used to get the same ☕ emoji, whether it was a croissant or
 * a bottle of water.
 */
const SECTION_ICON: Record<string, IconName> = {
  pouroverSection: 'pourover',
  beans_espresso_premium: 'cup-hot',
  beans_espresso_classic: 'cup-hot',
  matchaSection: 'matcha',
  healthyBreakfast: 'pastry',
  hotDrinks: 'cup-hot',
  winterItems: 'cup-hot',
  coldDrinks: 'cup-iced',
  desserts: 'dessert',
  miniMenu: 'cookie',
};

function iconOf(id: string, p: RawProduct): IconName {
  // The 1 L / 2 L gathering jugs sit in `extras` with the bags of beans.
  if (/gathering|jug/i.test(id)) return 'jug';
  return SECTION_ICON[p.section ?? ''] ?? 'beans';
}

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
/**
 * Sold out right now. The item stays on the menu — customers should see it
 * exists and comes back — but cannot be added. Before this the app offered
 * items the Foodics sync had already zeroed, and the order failed at the till.
 */
function isSoldOut(p: RawProduct): boolean {
  return Boolean(p.soldout_by || p.soldoutSource) || p.fxQty === 0;
}

/**
 * The method a product opens on, when there is a natural one.
 *
 * Espresso is «كلاسيك» unless the customer asks for freddo — the same default
 * Foodics has, where freddo is an optional +3 add-on. Hot vs cold has no such
 * default: in Foodics the jugs make «نوع القهوة» mandatory with nothing
 * preselected, and every other hot/cold drink is two separate products. So the
 * app must not pick one either; the customer chooses.
 */
function defaultMethodOf(methods: ProductMethod[]): BrewMethod | undefined {
  if (methods.length === 1) return methods[0].id;
  return methods.some((m) => m.id === 'classic') ? 'classic' : undefined;
}

function isPurchasable(p: RawProduct): boolean {
  return p.active !== false && p.purchasable === true;
}

/** The methods a product is priced by, in the store's order. Empty when priced once. */
function methodsOf(p: RawProduct): ProductMethod[] {
  const m = p.methodPriceHalalas;
  if (!m) return [];
  return METHOD_LABELS.filter(([id]) => m[id] != null).map(([id, labelAr]) => ({
    id,
    labelAr,
    price: Number(m[id]) / 100,
  }));
}

function toProduct(id: string, p: RawProduct): Product | null {
  const methods = methodsOf(p);
  // A product priced only per method has no base price of its own; its first
  // method is the price it opens with. Without this fallback such a product was
  // dropped from the menu entirely.
  const h = priceHalalas(p) ?? (methods[0] ? Math.round(methods[0].price * 100) : null);
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
    icon: iconOf(id, p),
    categoryId: categoryOf(id, p),
    isAvailable: !isSoldOut(p),
    isFeatured: false,
    tags: [],
    sizes: [],
    addOns: [],
    ...(methods.length > 0 ? { methods, defaultMethod: defaultMethodOf(methods) } : {}),
    rating: undefined,
    // Carried so the catalog store can apply `store/config/closedSections`:
    // the category label above merges several sections, so it cannot tell
    // breakfast from the rest once the section itself is gone.
    section: p.section ?? '',
  } as unknown as Product;
}

/** A catalog product with the raw section key it came from. */
export type CatalogProduct = Product & { section?: string };

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
 * `onError` fires when the listen is refused (rules, App Check). Without it
 * Firebase only logs a warning and never calls back, so the menu sat on its
 * skeleton forever with nothing to retry.
 *
 * Returns an unsubscribe.
 */
export function subscribeCatalog(
  cb: (snap: CatalogSnapshot) => void,
  onError?: (e: Error) => void,
): () => void {
  const database = db();
  const productsRef = ref(database, 'menu/products');

  /**
   * Signature of everything this app actually displays.
   *
   * ⚠️ Why this exists. `settlePayment` decrements
   * `menu/products/<serviceId>/stock` on every order that settles, so a listener
   * on the whole node wakes up for every sale the business makes — from the
   * website as well as the app. Without this guard each of those rebuilt all
   * 111 products, re-sorted them, and replaced the array, re-rendering the menu
   * for a field we do not even show. On a busy afternoon that is constant, and
   * it is what made the app feel like it was hanging.
   *
   * Only a change the customer could see gets through.
   */
  const signatureOf = (raw: Record<string, RawProduct>): string => {
    const parts: string[] = [];
    for (const id of Object.keys(raw).sort()) {
      const p = raw[id];
      if (!p) continue;
      parts.push(
        `${id}|${p.name ?? ''}|${p.nameEn ?? ''}|${p.desc ?? ''}|${p.section ?? ''}|${p.order ?? ''}|${p.image ?? ''}|${p.priceHalalas ?? ''}|${JSON.stringify(p.methodPriceHalalas ?? null)}|${p.active !== false ? 1 : 0}|${p.purchasable === true ? 1 : 0}|${isSoldOut(p) ? 1 : 0}`,
      );
    }
    return parts.join('\n');
  };

  let lastSignature: string | null = null;

  const onProducts = (s: DataSnapshot) => {
    const raw = (s.val() as Record<string, RawProduct>) || {};

    const signature = signatureOf(raw);
    if (signature === lastSignature) return; // stock-only change — nothing to redraw
    lastSignature = signature;

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
        // The group takes the icon of the first thing in it, in menu order.
        icon: p.icon,
      });
    }

    cb({ products, categories });
  };

  onValue(productsRef, onProducts, (e) => onError?.(e));
  return () => off(productsRef, 'value', onProducts);
}
