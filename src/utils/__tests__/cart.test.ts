import { describe, expect, it } from 'vitest';
import { buildCartLine, lineSignature, needsMethodChoice, resolvedMethod, selectionUnitPrice } from '@/utils/cart';
import type { Product } from '@/types';

/** Shaped like `storeCatalog.toProduct` output for the real menu rows. */
function product(over: Partial<Product>): Product {
  return {
    id: 'p',
    foodicsId: 'p',
    nameAr: 'منتج',
    nameEn: '',
    descriptionAr: '',
    descriptionEn: '',
    price: 39,
    image: null,
    icon: 'cup-hot',
    categoryId: 'x',
    sizes: [],
    addOns: [],
    isAvailable: true,
    isFeatured: false,
    tags: [],
    preparationTime: 5,
    ...over,
  };
}

// gathering_box_1l: hot and cold at the same price, no default (Foodics makes
// «نوع القهوة» mandatory with nothing preselected).
const jug = product({
  id: 'gathering_box_1l',
  nameAr: 'جك قهوة كولومبية [1 لتر]',
  methods: [
    { id: 'hot', labelAr: 'حار', price: 39 },
    { id: 'cold', labelAr: 'بارد', price: 39 },
  ],
});

// es_col_mango: classic 20, freddo 23 — classic is the natural default.
const espresso = product({
  id: 'es_col_mango',
  price: 20,
  methods: [
    { id: 'classic', labelAr: 'كلاسيك', price: 20 },
    { id: 'freddo', labelAr: 'فريدو', price: 23 },
  ],
  defaultMethod: 'classic',
});

describe('hot vs cold is never assumed', () => {
  it('requires a choice for hot/cold products', () => {
    expect(needsMethodChoice(jug)).toBe(true);
    expect(resolvedMethod(jug, {})).toBeUndefined();
  });

  it('does not require one when there is a natural default', () => {
    expect(needsMethodChoice(espresso)).toBe(false);
    expect(resolvedMethod(espresso, {})?.id).toBe('classic');
  });

  it('does not require one for a single-price product', () => {
    expect(needsMethodChoice(product({}))).toBe(false);
  });
});

describe('pricing by method', () => {
  it('uses the method price as the full price, not a delta', () => {
    expect(selectionUnitPrice(espresso, { addOnIds: [], qty: 1, method: 'freddo' })).toBe(23);
    expect(selectionUnitPrice(espresso, { addOnIds: [], qty: 1 })).toBe(20);
  });
});

describe('cart lines', () => {
  it('carries the chosen method so it reaches the order as `temp`', () => {
    const l = buildCartLine(jug, { addOnIds: [], qty: 2, method: 'cold' });
    expect(l.method).toBe('cold');
    expect(l.optionLabel).toBe('بارد');
    expect(l.unitPrice).toBe(39);
    expect(l.qty).toBe(2);
  });

  it('keeps hot and cold as separate lines', () => {
    const hot = lineSignature(jug, { addOnIds: [], qty: 1, method: 'hot' });
    const cold = lineSignature(jug, { addOnIds: [], qty: 1, method: 'cold' });
    expect(hot).not.toBe(cold);
  });

  it('merges identical selections', () => {
    const a = lineSignature(espresso, { addOnIds: [], qty: 1 });
    const b = lineSignature(espresso, { addOnIds: [], qty: 3, method: 'classic' });
    expect(a).toBe(b);
  });
});
