import type { Category, Modifier, ModifierOption, Product } from '@prisma/client';
import { prisma } from '../../database/prisma';
import { NotFound } from '../../common/errors';

type ModifierWithOptions = Modifier & { options: ModifierOption[] };
type ProductWithModifiers = Product & { modifiers: ModifierWithOptions[] };

function toCategoryDTO(c: Category) {
  return { id: c.id, nameAr: c.nameAr, nameEn: c.nameEn ?? undefined, sortOrder: c.sortOrder };
}

function toModifierDTO(m: ModifierWithOptions) {
  return {
    id: m.id,
    nameAr: m.nameAr,
    nameEn: m.nameEn ?? undefined,
    minSelected: m.minSelected,
    maxSelected: m.maxSelected,
    isRequired: m.isRequired,
    options: m.options.map((o) => ({
      id: o.id,
      nameAr: o.nameAr,
      nameEn: o.nameEn ?? undefined,
      price: o.price, // halalas
      isAvailable: o.isAvailable,
    })),
  };
}

export function toProductDTO(p: ProductWithModifiers) {
  return {
    id: p.id,
    categoryId: p.categoryId,
    nameAr: p.nameAr,
    nameEn: p.nameEn ?? undefined,
    descriptionAr: p.descriptionAr ?? undefined,
    descriptionEn: p.descriptionEn ?? undefined,
    price: p.price, // halalas
    image: p.image ?? null,
    calories: p.calories ?? undefined,
    isAvailable: p.isAvailable,
    isFeatured: p.isFeatured,
    preparationTime: p.preparationTime ?? undefined,
    modifiers: p.modifiers.map(toModifierDTO),
  };
}

const productInclude = { modifiers: { include: { options: true } } } as const;

export async function getMenu() {
  const [categories, products] = await Promise.all([
    prisma.category.findMany({ where: { isActive: true }, orderBy: { sortOrder: 'asc' } }),
    prisma.product.findMany({ include: productInclude, orderBy: { createdAt: 'asc' } }),
  ]);
  return {
    categories: categories.map(toCategoryDTO),
    products: products.map(toProductDTO),
  };
}

export async function getProductById(id: string) {
  const product = await prisma.product.findUnique({ where: { id }, include: productInclude });
  if (!product) throw NotFound('المنتج غير موجود');
  return toProductDTO(product);
}
