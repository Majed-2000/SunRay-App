import type { BrewMethod, CartLine, Product } from '@/types';

export interface ProductSelection {
  sizeId?: string;
  addOnIds: string[];
  /** Brewing method, for products priced per method. */
  method?: BrewMethod;
  notes?: string;
  qty: number;
}

/**
 * True when the customer has to pick a method themselves — hot vs cold — and
 * nothing may be assumed for them. Quick-add and reorder must send such a
 * product to its screen rather than add it.
 */
export function needsMethodChoice(product: Product): boolean {
  return (product.methods?.length ?? 0) > 1 && !product.defaultMethod;
}

/**
 * The method a selection lands on: the chosen one, else the product's
 * default. `undefined` while a required choice is still open.
 */
export function resolvedMethod(product: Product, sel: Pick<ProductSelection, 'method'>) {
  const methods = product.methods ?? [];
  return methods.find((m) => m.id === (sel.method ?? product.defaultMethod));
}

/** Resolve unit price for a product + selection. */
export function selectionUnitPrice(product: Product, sel: ProductSelection): number {
  // A method price is the full price, not a delta — the same way the server
  // reads `methodPriceHalalas`. With the choice still open, the product's own
  // price (its first method's) stands in for display only.
  let price = resolvedMethod(product, sel)?.price ?? product.price;
  if (sel.sizeId) {
    const size = product.sizes.find((s) => s.id === sel.sizeId);
    if (size) price += size.priceDelta;
  }
  for (const id of sel.addOnIds) {
    const add = product.addOns.find((a) => a.id === id);
    if (add) price += add.priceDelta;
  }
  return price;
}

/** Human-readable option label, e.g. "بارد · وسط · حليب لوز". */
export function selectionLabel(product: Product, sel: ProductSelection): string {
  const parts: string[] = [];
  const method = resolvedMethod(product, sel);
  if (method) parts.push(method.labelAr);
  if (sel.sizeId) {
    const size = product.sizes.find((s) => s.id === sel.sizeId);
    if (size) parts.push(size.labelAr);
  }
  for (const id of sel.addOnIds) {
    const add = product.addOns.find((a) => a.id === id);
    if (add) parts.push(add.labelAr);
  }
  return parts.length ? parts.join(' · ') : 'قطعة';
}

/** Stable signature so identical selections merge into one cart line. */
export function lineSignature(product: Product, sel: ProductSelection): string {
  const adds = [...sel.addOnIds].sort().join(',');
  const method = resolvedMethod(product, sel)?.id ?? '-';
  return [product.id, method, sel.sizeId ?? '-', adds, (sel.notes ?? '').trim()].join('|');
}

export function buildCartLine(product: Product, sel: ProductSelection): CartLine {
  return {
    id: lineSignature(product, sel),
    productId: product.id,
    nameAr: product.nameAr,
    nameEn: product.nameEn,
    icon: product.icon,
    optionLabel: selectionLabel(product, sel),
    sizeId: sel.sizeId,
    addOnIds: sel.addOnIds,
    method: resolvedMethod(product, sel)?.id,
    notes: sel.notes?.trim() || undefined,
    unitPrice: selectionUnitPrice(product, sel),
    qty: sel.qty,
  };
}
