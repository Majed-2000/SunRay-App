import type { CartLine, Product } from '@/types';

export interface ProductSelection {
  sizeId?: string;
  addOnIds: string[];
  notes?: string;
  qty: number;
}

/** Resolve unit price for a product + selection. */
export function selectionUnitPrice(product: Product, sel: ProductSelection): number {
  let price = product.price;
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

/** Human-readable option label, e.g. "وسط · حليب لوز · شوت إضافي". */
export function selectionLabel(product: Product, sel: ProductSelection): string {
  const parts: string[] = [];
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
  return [product.id, sel.sizeId ?? '-', adds, (sel.notes ?? '').trim()].join('|');
}

export function buildCartLine(product: Product, sel: ProductSelection): CartLine {
  return {
    id: lineSignature(product, sel),
    productId: product.id,
    nameAr: product.nameAr,
    nameEn: product.nameEn,
    emoji: product.emoji,
    optionLabel: selectionLabel(product, sel),
    sizeId: sel.sizeId,
    addOnIds: sel.addOnIds,
    notes: sel.notes?.trim() || undefined,
    unitPrice: selectionUnitPrice(product, sel),
    qty: sel.qty,
  };
}
