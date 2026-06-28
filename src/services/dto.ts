/**
 * Backend response types + mappers.
 *
 * Our backend returns slightly different shapes than the app's internal types
 * (and money in integer halalas). These mappers translate a backend response
 * into the app's existing `Branch`/`Category`/`Product`/`User` types so the
 * screens DON'T need to change. Convert halalas → SAR here (1800 → 18).
 */
import type {
  Branch,
  Category,
  Order,
  OrderItemSnapshot,
  OrderType,
  Product,
  ProductAddOn,
  ProductSize,
  User,
} from '@/types';
import { FoodicsOrderStatus, FoodicsDeliveryStatus } from '@/types';

const toSar = (halalas: number) => halalas / 100;

// ── Backend shapes (what the API actually sends) ──────────────────────────────
export interface BranchDTO {
  id: string;
  name: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  openingFrom?: string;
  openingTo?: string;
  isActive: boolean;
}

export interface CategoryDTO {
  id: string;
  nameAr: string;
  nameEn?: string;
  sortOrder: number;
}

export interface ModifierOptionDTO {
  id: string;
  nameAr: string;
  nameEn?: string;
  price: number; // halalas
  isAvailable: boolean;
}

export interface ModifierDTO {
  id: string;
  nameAr: string;
  nameEn?: string;
  minSelected: number;
  maxSelected: number;
  isRequired: boolean;
  options: ModifierOptionDTO[];
}

export interface ProductDTO {
  id: string;
  categoryId: string;
  nameAr: string;
  nameEn?: string;
  descriptionAr?: string;
  descriptionEn?: string;
  price: number; // halalas
  image: string | null;
  calories?: number;
  isAvailable: boolean;
  isFeatured: boolean;
  preparationTime?: number;
  modifiers: ModifierDTO[];
}

export interface MenuDTO {
  categories: CategoryDTO[];
  products: ProductDTO[];
}

export interface CustomerDTO {
  id: string;
  name: string;
  phone: string;
  countryCode: string;
  email?: string;
  gender?: 'male' | 'female';
  city?: string;
  birthDay?: number;
  birthMonth?: number;
  createdAt: number;
}

// ── Mappers ──────────────────────────────────────────────────────────────────
export function mapBranch(b: BranchDTO): Branch {
  return {
    id: b.id,
    foodicsId: b.id,
    nameAr: b.name,
    nameEn: b.name,
    areaAr: b.address ?? b.name,
    addressAr: b.address ?? b.name,
    lat: b.latitude ?? 0,
    lng: b.longitude ?? 0,
    isOpen: b.isActive,
    hoursAr: b.openingFrom && b.openingTo ? `${b.openingFrom} - ${b.openingTo}` : '',
    openingFrom: b.openingFrom ?? '',
    openingTo: b.openingTo ?? '',
    distanceKm: 0,
    supportsDelivery: true,
    supportsDineIn: true,
  };
}

/** Pick a placeholder emoji from a category's name (best-effort). */
function categoryEmoji(nameAr: string, nameEn?: string): string {
  const s = `${nameAr} ${nameEn ?? ''}`.toLowerCase();
  if (s.includes('matcha') || s.includes('ماتشا')) return '🍵';
  if (s.includes('cold') || s.includes('بارد')) return '🧊';
  if (s.includes('v60') || s.includes('في٦٠')) return '🫖';
  if (s.includes('bakery') || s.includes('مخبوز')) return '🥐';
  if (s.includes('dessert') || s.includes('حلا') || s.includes('حلى')) return '🍰';
  if (s.includes('sandwich') || s.includes('ساندويتش')) return '🥪';
  if (s.includes('water') || s.includes('مياه')) return '💧';
  return '☕';
}

export function mapCategory(c: CategoryDTO): Category {
  return {
    id: c.id,
    foodicsId: c.id,
    nameAr: c.nameAr,
    nameEn: c.nameEn ?? c.nameAr,
    emoji: categoryEmoji(c.nameAr, c.nameEn),
  };
}

function mapSize(o: ModifierOptionDTO): ProductSize {
  return {
    id: o.id,
    foodicsId: o.id,
    labelAr: o.nameAr,
    labelEn: o.nameEn ?? o.nameAr,
    priceDelta: toSar(o.price),
  };
}

function mapAddOn(o: ModifierOptionDTO, group: 'milk' | 'extra'): ProductAddOn {
  return {
    id: o.id,
    foodicsId: o.id,
    labelAr: o.nameAr,
    labelEn: o.nameEn ?? o.nameAr,
    priceDelta: toSar(o.price),
    group,
  };
}

function isSizeModifier(m: ModifierDTO): boolean {
  const s = `${m.nameAr} ${m.nameEn ?? ''}`.toLowerCase();
  return s.includes('size') || s.includes('حجم');
}
function isMilkModifier(m: ModifierDTO): boolean {
  const s = `${m.nameAr} ${m.nameEn ?? ''}`.toLowerCase();
  return s.includes('milk') || s.includes('حليب');
}

export function mapProduct(p: ProductDTO, emoji: string): Product {
  // Flatten backend modifiers into the app's sizes/addOns shape so the existing
  // product-detail UI works unchanged. (Heuristic: a modifier named "size"/"حجم"
  // becomes sizes; "milk"/"حليب" becomes milk add-ons; everything else extras.)
  const sizes: ProductSize[] = [];
  const addOns: ProductAddOn[] = [];
  for (const m of p.modifiers) {
    if (isSizeModifier(m)) {
      sizes.push(...m.options.map(mapSize));
    } else {
      const group = isMilkModifier(m) ? 'milk' : 'extra';
      addOns.push(...m.options.map((o) => mapAddOn(o, group)));
    }
  }
  return {
    id: p.id,
    foodicsId: p.id,
    nameAr: p.nameAr,
    nameEn: p.nameEn ?? p.nameAr,
    descriptionAr: p.descriptionAr ?? '',
    descriptionEn: p.descriptionEn ?? '',
    price: toSar(p.price),
    image: p.image,
    emoji,
    categoryId: p.categoryId,
    calories: p.calories,
    sizes,
    addOns,
    isAvailable: p.isAvailable,
    isFeatured: p.isFeatured,
    tags: p.isFeatured ? ['مميز'] : [],
    preparationTime: p.preparationTime ?? 5,
  };
}

export function mapMenu(dto: MenuDTO): { categories: Category[]; products: Product[] } {
  const categories = dto.categories.map(mapCategory);
  // Build a categoryId → emoji map so products get a sensible placeholder emoji.
  const emojiByCat = new Map(categories.map((c) => [c.id, c.emoji]));
  const products = dto.products.map((p) => mapProduct(p, emojiByCat.get(p.categoryId) ?? '☕'));
  return { categories, products };
}

export function mapCustomer(c: CustomerDTO): User {
  return {
    id: c.id,
    name: c.name,
    phone: c.phone,
    email: c.email,
    gender: c.gender,
    city: c.city,
    birthDay: c.birthDay,
    birthMonth: c.birthMonth,
    avatarText: c.name?.trim().charAt(0) || 'ض',
    joinedAt: c.createdAt,
  };
}

// ── Orders ───────────────────────────────────────────────────────────────────
export type BackendOrderType = 'PICKUP' | 'DELIVERY' | 'DINE_IN';
export type BackendOrderStatus =
  | 'PENDING'
  | 'ACCEPTED'
  | 'PREPARING'
  | 'READY'
  | 'EN_ROUTE'
  | 'COMPLETED'
  | 'CANCELLED';

export interface OrderItemDTO {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number; // halalas
  totalPrice: number; // halalas
  notes?: string;
}

export interface OrderDTO {
  id: string;
  customerId?: string;
  branchId?: string;
  type: BackendOrderType;
  status: BackendOrderStatus;
  subtotal: number; // halalas
  vat: number;
  deliveryFee: number;
  discount: number;
  total: number;
  customerNotes?: string;
  scheduledAt?: number;
  createdAt: number;
  items: OrderItemDTO[];
}

const BACKEND_TYPE_TO_APP: Record<BackendOrderType, OrderType> = {
  PICKUP: 'pickup',
  DELIVERY: 'delivery',
  DINE_IN: 'dineIn',
};

export const APP_TYPE_TO_BACKEND: Record<OrderType, BackendOrderType> = {
  pickup: 'PICKUP',
  delivery: 'DELIVERY',
  dineIn: 'DINE_IN',
};

/**
 * Map the backend's string status onto the app's numeric (status, deliveryStatus)
 * so the existing tracking UI (orderStage / flowStages / currentStepIndex) works.
 */
function backendStatusToNumeric(status: BackendOrderStatus, isDelivery: boolean) {
  switch (status) {
    case 'PENDING':
      return { status: FoodicsOrderStatus.Pending, deliveryStatus: null };
    case 'ACCEPTED':
    case 'PREPARING':
      return {
        status: FoodicsOrderStatus.Active,
        deliveryStatus: isDelivery ? FoodicsDeliveryStatus.SentToKitchen : null,
      };
    case 'READY':
      return { status: FoodicsOrderStatus.Active, deliveryStatus: FoodicsDeliveryStatus.Ready };
    case 'EN_ROUTE':
      return { status: FoodicsOrderStatus.Active, deliveryStatus: FoodicsDeliveryStatus.EnRoute };
    case 'COMPLETED':
      return {
        status: FoodicsOrderStatus.Closed,
        deliveryStatus: isDelivery ? FoodicsDeliveryStatus.Delivered : null,
      };
    case 'CANCELLED':
      return { status: FoodicsOrderStatus.Declined, deliveryStatus: null };
    default:
      return { status: FoodicsOrderStatus.Pending, deliveryStatus: null };
  }
}

export function mapOrder(o: OrderDTO): Order {
  const type = BACKEND_TYPE_TO_APP[o.type] ?? 'pickup';
  const isDelivery = type === 'delivery';
  const { status, deliveryStatus } = backendStatusToNumeric(o.status, isDelivery);
  const subtotal = toSar(o.subtotal);
  const items: OrderItemSnapshot[] = o.items.map((it) => ({
    nameAr: it.productName,
    optionLabel: it.notes ?? '',
    qty: it.quantity,
    lineTotal: toSar(it.totalPrice),
  }));
  return {
    id: o.id,
    foodicsOrderId: null,
    createdAt: o.createdAt,
    type,
    status,
    deliveryStatus,
    branchId: o.branchId ?? '',
    items,
    subtotal,
    vat: toSar(o.vat),
    deliveryFee: toSar(o.deliveryFee),
    discount: toSar(o.discount),
    total: toSar(o.total),
    // App-only fields the backend doesn't track this phase (display defaults):
    paymentMethod: 'cash',
    pointsEarned: Math.round(subtotal),
    etaMinutes: isDelivery ? 25 : 12,
  };
}
