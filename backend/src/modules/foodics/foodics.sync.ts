/**
 * Menu sync: Foodics → our database.
 *
 * READ-ONLY against Foodics. It never creates or modifies anything there, so it
 * is safe to run against the production business.
 *
 * The filtering rules here are not guesswork — each one was established by
 * testing against the live account, and skipping any of them produces a wrong
 * menu:
 *
 *   • /products cannot be filtered by branch (filter[branches.id] → 400), so we
 *     pull everything with include=branches and filter locally.
 *   • /products returns SOFT-DELETED rows (deleted_at set). They must be
 *     excluded by hand — 6 of 117 were deleted and still came back.
 *   • include=modifiers is mandatory; without it every product reports zero
 *     modifiers (observed: 0 of 111).
 *   • branches[].pivot.price is a branch-specific override that beats the
 *     top-level price whenever it is not null.
 *   • name_localized carries the Arabic name; name is the English one.
 */
import { prisma } from '../../database/prisma';
import { env } from '../../config/env';
import { logger } from '../../common/logger';
import { foodics } from './foodics.client';

interface FoodicsBranch {
  id: string;
  name: string;
  name_localized: string | null;
  latitude: number | null;
  longitude: number | null;
  opening_from: string | null;
  opening_to: string | null;
  deleted_at: string | null;
}

interface FoodicsCategory {
  id: string;
  name: string;
  name_localized: string | null;
  deleted_at: string | null;
}

/**
 * A modifier as it appears INSIDE a product (include=modifiers).
 *
 * It carries no options — only the link and its `pivot`. The options live on the
 * modifier definition and must be fetched separately (see fetchModifierOptions).
 */
interface FoodicsModifierLink {
  id: string;
  name: string;
  name_localized: string | null;
  deleted_at: string | null;
  pivot?: {
    minimum_options: number;
    maximum_options: number;
    free_options: number;
    /** Options hidden for THIS product even though the modifier defines them. */
    excluded_options_ids?: string[];
    default_options_ids?: string[];
    index: number;
  };
}

interface FoodicsModifierOption {
  id: string;
  name: string;
  name_localized: string | null;
  price: number;
  is_active: boolean;
  deleted_at: string | null;
  index: number;
}

interface FoodicsProduct {
  id: string;
  name: string;
  name_localized: string | null;
  description: string | null;
  description_localized: string | null;
  price: number;
  calories: number | null;
  image: string | null;
  is_active: boolean;
  deleted_at: string | null;
  category?: { id: string } | null;
  modifiers?: FoodicsModifierLink[];
  branches?: Array<{
    id: string;
    pivot?: { price: number | null; is_active: boolean; is_in_stock: boolean };
  }>;
}

export interface SyncReport {
  branches: { seen: number; upserted: number; missingCoordinates: string[] };
  categories: { seen: number; upserted: number };
  products: { seen: number; kept: number; upserted: number; skipped: Record<string, number> };
  modifiers: { definitionsFetched: number; linksCreated: number; optionsCreated: number };
}

/** SAR (decimal) → halalas (integer). Money is never a float in this codebase. */
const toHalalas = (sar: number): number => Math.round(sar * 100);

/**
 * Fetch a modifier's options, memoised for the duration of one sync run.
 *
 * Two API quirks force this shape:
 *  - `include=modifiers` on a product returns the link and its pivot, but NEVER
 *    the options.
 *  - `GET /modifiers?include=options` (the LIST) returns options as an empty
 *    array. Only the SINGLE `GET /modifiers/{id}` populates them.
 *
 * Modifiers are shared across products (22 definitions covering 111 products),
 * so without the cache this would issue hundreds of calls and risk the 429 that
 * previously delayed a live customer order.
 */
async function fetchModifierOptions(
  modifierId: string,
  cache: Map<string, FoodicsModifierOption[]>,
): Promise<FoodicsModifierOption[]> {
  const hit = cache.get(modifierId);
  if (hit) return hit;

  const res = await foodics.get<{ data: { options?: FoodicsModifierOption[] } }>(
    `/modifiers/${modifierId}`,
  );
  const options = res.data?.options ?? [];
  cache.set(modifierId, options);
  return options;
}

export async function syncFoodicsMenu(): Promise<SyncReport> {
  if (!foodics.configured) throw new Error('FOODICS_TOKEN is not configured');

  const branchId = env.FOODICS_BRANCH_ID;
  const report: SyncReport = {
    branches: { seen: 0, upserted: 0, missingCoordinates: [] },
    categories: { seen: 0, upserted: 0 },
    products: { seen: 0, kept: 0, upserted: 0, skipped: {} },
    modifiers: { definitionsFetched: 0, linksCreated: 0, optionsCreated: 0 },
  };
  /** modifier id → its options, fetched at most once per sync run. */
  const optionCache = new Map<string, FoodicsModifierOption[]>();
  const skip = (reason: string) => {
    report.products.skipped[reason] = (report.products.skipped[reason] ?? 0) + 1;
  };

  // ── Branches ───────────────────────────────────────────────────────────────
  const branches = await foodics.listAll<FoodicsBranch>('/branches');
  report.branches.seen = branches.length;

  for (const b of branches) {
    if (b.deleted_at) continue;
    // Only the configured branch is ours. "البلد" was a seasonal branch that has
    // since closed, and it still exists in Foodics — syncing it would put a
    // branch customers cannot order from into the app's branch picker.
    if (branchId && b.id !== branchId) {
      await prisma.branch
        .updateMany({ where: { foodicsId: b.id }, data: { isActive: false } })
        .catch(() => undefined);
      continue;
    }
    // Missing coordinates are a SILENT failure mode: POST /orders still returns
    // 2xx but the order never reaches the cashier. Surface it loudly instead.
    if (b.latitude == null || b.longitude == null) {
      report.branches.missingCoordinates.push(b.name_localized || b.name);
    }
    await prisma.branch.upsert({
      where: { foodicsId: b.id },
      create: {
        foodicsId: b.id,
        name: b.name_localized || b.name,
        latitude: b.latitude,
        longitude: b.longitude,
        openingFrom: b.opening_from,
        openingTo: b.opening_to,
        isActive: true,
      },
      update: {
        name: b.name_localized || b.name,
        // Only overwrite coordinates when Foodics actually has them. Both
        // branches currently return null, and blindly copying that would wipe
        // any coordinates set locally on every sync — breaking the app's branch
        // map for no reason. Foodics stays authoritative for what it knows;
        // absence of data is not data.
        ...(b.latitude != null && b.longitude != null
          ? { latitude: b.latitude, longitude: b.longitude }
          : {}),
        openingFrom: b.opening_from,
        openingTo: b.opening_to,
      },
    });
    report.branches.upserted += 1;
  }

  // ── Categories ─────────────────────────────────────────────────────────────
  const categories = await foodics.listAll<FoodicsCategory>('/categories');
  report.categories.seen = categories.length;

  const categoryIdByFoodicsId = new Map<string, string>();
  let sortOrder = 0;
  for (const c of categories) {
    if (c.deleted_at) continue;
    const row = await prisma.category.upsert({
      where: { foodicsId: c.id },
      create: {
        foodicsId: c.id,
        nameAr: c.name_localized || c.name,
        nameEn: c.name,
        sortOrder: sortOrder++,
        isActive: true,
      },
      update: { nameAr: c.name_localized || c.name, nameEn: c.name },
    });
    categoryIdByFoodicsId.set(c.id, row.id);
    report.categories.upserted += 1;
  }

  // ── Products ───────────────────────────────────────────────────────────────
  const products = await foodics.listAll<FoodicsProduct>('/products', {
    include: ['category', 'branches', 'modifiers'],
  });
  report.products.seen = products.length;

  for (const p of products) {
    if (p.deleted_at) {
      skip('soft-deleted');
      continue;
    }
    if (!p.is_active) {
      skip('inactive');
      continue;
    }
    if (!p.category?.id) {
      skip('no-category');
      continue;
    }
    const localCategoryId = categoryIdByFoodicsId.get(p.category.id);
    if (!localCategoryId) {
      skip('category-not-synced');
      continue;
    }

    // Branch scoping happens here because the API refuses to do it for us.
    const link = branchId ? p.branches?.find((b) => b.id === branchId) : undefined;
    if (branchId && !link) {
      skip('not-in-branch');
      continue;
    }
    if (link?.pivot && link.pivot.is_active === false) {
      skip('inactive-in-branch');
      continue;
    }

    const priceSar = link?.pivot?.price ?? p.price;
    report.products.kept += 1;

    const productRow = await prisma.product.upsert({
      where: { foodicsId: p.id },
      create: {
        foodicsId: p.id,
        categoryId: localCategoryId,
        nameAr: p.name_localized || p.name,
        nameEn: p.name,
        descriptionAr: p.description_localized,
        descriptionEn: p.description,
        price: toHalalas(priceSar),
        image: p.image,
        calories: p.calories,
        isAvailable: link?.pivot?.is_in_stock ?? true,
      },
      update: {
        categoryId: localCategoryId,
        nameAr: p.name_localized || p.name,
        nameEn: p.name,
        descriptionAr: p.description_localized,
        descriptionEn: p.description,
        price: toHalalas(priceSar),
        image: p.image,
        calories: p.calories,
        isAvailable: link?.pivot?.is_in_stock ?? true,
      },
    });
    report.products.upserted += 1;

    // ── Modifiers for this product ───────────────────────────────────────────
    // Our schema stores a Modifier per product, whereas Foodics defines each
    // modifier once and shares it across products via a pivot. So we rebuild
    // this product's rows from scratch every sync: it keeps Foodics as the
    // single source of truth and avoids stale options lingering after a change
    // in the console. Safe to delete — nothing references Modifier or
    // ModifierOption (OrderItem points at Product, not at these).
    const existing = await prisma.modifier.findMany({
      where: { productId: productRow.id },
      select: { id: true },
    });
    if (existing.length) {
      const ids = existing.map((m) => m.id);
      await prisma.modifierOption.deleteMany({ where: { modifierId: { in: ids } } });
      await prisma.modifier.deleteMany({ where: { id: { in: ids } } });
    }

    const links = (p.modifiers ?? [])
      .filter((m) => !m.deleted_at)
      .sort((a, b) => (a.pivot?.index ?? 0) - (b.pivot?.index ?? 0));

    for (const m of links) {
      const before = optionCache.size;
      const allOptions = await fetchModifierOptions(m.id, optionCache);
      if (optionCache.size > before) report.modifiers.definitionsFetched += 1;

      const excluded = new Set(m.pivot?.excluded_options_ids ?? []);
      const options = allOptions
        .filter((o) => !o.deleted_at && o.is_active && !excluded.has(o.id))
        .sort((a, b) => (a.index ?? 0) - (b.index ?? 0));

      // A modifier with no selectable options would render as an empty group in
      // the app — skip it rather than show the customer a dead control.
      if (!options.length) continue;

      const minimum = m.pivot?.minimum_options ?? 0;
      await prisma.modifier.create({
        data: {
          // Foodics ids are carried through because order injection needs them:
          // POST /orders identifies a chosen option by its Foodics UUID, not by
          // our local id.
          foodicsId: m.id,
          productId: productRow.id,
          nameAr: m.name_localized || m.name,
          nameEn: m.name,
          minSelected: minimum,
          maxSelected: m.pivot?.maximum_options ?? 1,
          isRequired: minimum > 0,
          options: {
            create: options.map((o) => ({
              foodicsId: o.id,
              nameAr: o.name_localized || o.name,
              nameEn: o.name,
              price: toHalalas(o.price ?? 0),
              isAvailable: true,
            })),
          },
        },
      });
      report.modifiers.linksCreated += 1;
      report.modifiers.optionsCreated += options.length;
    }
  }

  logger.info(
    `Foodics sync: ${report.branches.upserted} branches, ${report.categories.upserted} categories, ` +
      `${report.products.upserted} products, ${report.modifiers.linksCreated} modifier groups ` +
      `(${report.modifiers.optionsCreated} options, ${report.modifiers.definitionsFetched} definitions fetched)`,
  );
  if (report.branches.missingCoordinates.length) {
    logger.warn(
      `Branches without coordinates (orders will NOT reach the cashier): ${report.branches.missingCoordinates.join(', ')}`,
    );
  }
  return report;
}
