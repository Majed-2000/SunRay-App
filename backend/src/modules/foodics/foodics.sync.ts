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
  branches?: Array<{
    id: string;
    pivot?: { price: number | null; is_active: boolean; is_in_stock: boolean };
  }>;
}

export interface SyncReport {
  branches: { seen: number; upserted: number; missingCoordinates: string[] };
  categories: { seen: number; upserted: number };
  products: { seen: number; kept: number; upserted: number; skipped: Record<string, number> };
}

/** SAR (decimal) → halalas (integer). Money is never a float in this codebase. */
const toHalalas = (sar: number): number => Math.round(sar * 100);

export async function syncFoodicsMenu(): Promise<SyncReport> {
  if (!foodics.configured) throw new Error('FOODICS_TOKEN is not configured');

  const branchId = env.FOODICS_BRANCH_ID;
  const report: SyncReport = {
    branches: { seen: 0, upserted: 0, missingCoordinates: [] },
    categories: { seen: 0, upserted: 0 },
    products: { seen: 0, kept: 0, upserted: 0, skipped: {} },
  };
  const skip = (reason: string) => {
    report.products.skipped[reason] = (report.products.skipped[reason] ?? 0) + 1;
  };

  // ── Branches ───────────────────────────────────────────────────────────────
  const branches = await foodics.listAll<FoodicsBranch>('/branches');
  report.branches.seen = branches.length;

  for (const b of branches) {
    if (b.deleted_at) continue;
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
        latitude: b.latitude,
        longitude: b.longitude,
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

    await prisma.product.upsert({
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
  }

  logger.info(
    `Foodics sync: ${report.branches.upserted} branches, ${report.categories.upserted} categories, ${report.products.upserted} products`,
  );
  if (report.branches.missingCoordinates.length) {
    logger.warn(
      `Branches without coordinates (orders will NOT reach the cashier): ${report.branches.missingCoordinates.join(', ')}`,
    );
  }
  return report;
}
