/**
 * Foodics mapping reference (app-side, NO network, NO secrets).
 *
 * The mobile app NEVER calls Foodics or holds the Foodics OAuth token. All live
 * data flows through OUR backend (`/api/*`, see api.ts + the service modules).
 * This file documents the Foodics ↔ app mapping knowledge the BACKEND needs and
 * exposes pure helpers/constants the app can safely reference (enums, scopes,
 * webhook events, order-type mapping). See `.claude/FOODICS_API.md`.
 */
import type { Branch, OrderType, Product, CategoryId } from '@/types';
import {
  FoodicsOrderType,
  FoodicsOrderStatus,
  FoodicsDeliveryStatus,
  type OrderStage,
} from './foodics.types';

export {
  FoodicsOrderType,
  FoodicsOrderStatus,
  FoodicsOrderSource,
  FoodicsDeliveryStatus,
  FoodicsDiscountType,
} from './foodics.types';

// ───────────────────────── Reference constants ─────────────────────────
export const FOODICS = {
  apiVersion: 'v5',
  // Reference only — the app must not call these directly.
  productionBaseUrl: 'https://api.foodics.com/v5',
  sandboxBaseUrl: 'https://api-sandbox.foodics.com/v5',
  // The app calls our backend (api.ts API_BASE_URL) under `/foodics/*` & `/api/*`.
  proxyPathPrefix: '/foodics',
  // Order Tag attached to every injected order to segregate our channel.
  orderChannelTag: 'SunRayApp',
} as const;

/** OAuth scopes our backend needs — Path A loyalty (`.claude/FOODICS_API.md §3`). */
export const REQUIRED_SCOPES = [
  'general.read',
  'orders.limited.create',
  'orders.list',
  'orders.get',
  'customers.list',
  'customers.get',
  'customers.write',
  'orders.gift_cards.read',
  'orders.gift_cards.write',
  'coupons.read',
  'coupons.write',
] as const;

/** Webhook events the backend subscribes to (the engine for all flows). */
export const WEBHOOK_EVENTS = [
  'application.order.updated', // status changes on orders we created
  'customer.order.created', // loyalty cup counting
  'menu.updated', // re-sync the affected entity
] as const;

// ───────────────────────── our ↔ Foodics mapping ─────────────────────────
export function toFoodicsOrderType(type: OrderType): FoodicsOrderType {
  switch (type) {
    case 'dineIn':
      return FoodicsOrderType.DineIn;
    case 'delivery':
      return FoodicsOrderType.Delivery;
    case 'pickup':
    default:
      return FoodicsOrderType.PickUp;
  }
}

export function fromFoodicsOrderType(type: FoodicsOrderType): OrderType {
  switch (type) {
    case FoodicsOrderType.DineIn:
      return 'dineIn';
    case FoodicsOrderType.Delivery:
      return 'delivery';
    default:
      return 'pickup';
  }
}

/**
 * Derive the customer-facing stage from Foodics (status, deliveryStatus).
 * Delivery status (when present) is more granular and takes precedence.
 */
export function foodicsStatusToStage(
  status: FoodicsOrderStatus,
  deliveryStatus: FoodicsDeliveryStatus | null,
): OrderStage {
  if (
    status === FoodicsOrderStatus.Declined ||
    status === FoodicsOrderStatus.Returned ||
    status === FoodicsOrderStatus.Void
  ) {
    return 'cancelled';
  }
  if (status === FoodicsOrderStatus.Closed) return 'completed';
  if (deliveryStatus != null) {
    switch (deliveryStatus) {
      case FoodicsDeliveryStatus.SentToKitchen:
        return 'preparing';
      case FoodicsDeliveryStatus.Ready:
        return 'ready';
      case FoodicsDeliveryStatus.Assigned:
      case FoodicsDeliveryStatus.EnRoute:
        return 'enRoute';
      case FoodicsDeliveryStatus.Delivered:
      case FoodicsDeliveryStatus.Closed:
        return 'completed';
    }
  }
  if (status === FoodicsOrderStatus.Pending) return 'pending';
  return 'preparing'; // Active, no delivery status → being prepared
}

// ───────────────────────── Raw Foodics shapes (subset) ─────────────────────────
export interface FoodicsBranch {
  id: string;
  name: string;
  name_localized?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  opening_from?: string | null; // "HH:MM:SS"
  opening_to?: string | null;
}

export interface FoodicsProduct {
  id: string;
  name: string;
  name_localized?: string | null;
  description?: string | null;
  description_localized?: string | null;
  price: number;
  is_active?: boolean;
  image?: string | null;
  calories?: number | null;
  preparation_time?: number | null;
  category?: { id: string } | null;
}

// ───────────────────────── Mappers: raw Foodics → app types ─────────────────────────
// (Backend-side reference. The app receives already-mapped app types from /api/*.)
export function isBranchOpenNow(b: FoodicsBranch, now = new Date()): boolean {
  if (!b.opening_from || !b.opening_to) return true;
  const cur = now.getHours() * 60 + now.getMinutes();
  const [fh, fm] = b.opening_from.split(':').map(Number);
  const [th, tm] = b.opening_to.split(':').map(Number);
  const from = fh * 60 + fm;
  const to = th * 60 + tm;
  return from <= to ? cur >= from && cur < to : cur >= from || cur < to;
}

export function mapBranch(b: FoodicsBranch): Branch {
  const name = b.name_localized || b.name;
  return {
    id: b.id,
    foodicsId: b.id,
    nameAr: name,
    nameEn: b.name,
    areaAr: name,
    addressAr: name,
    lat: b.latitude ?? 0,
    lng: b.longitude ?? 0,
    isOpen: isBranchOpenNow(b),
    hoursAr: b.opening_from && b.opening_to ? `${b.opening_from} - ${b.opening_to}` : '',
    openingFrom: b.opening_from ?? '',
    openingTo: b.opening_to ?? '',
    distanceKm: 0, // computed client-side from device geolocation
    supportsDelivery: true, // refine from delivery-zone config server-side
    supportsDineIn: true,
  };
}

/**
 * Map a Foodics product → our Product. The Foodics category is a UUID, so the
 * caller supplies the resolved app CategoryId; Foodics modifiers map into our
 * `sizes`/`addOns` server-side (left empty here). `emoji` is a presentation default.
 */
export function mapProduct(p: FoodicsProduct, categoryId: CategoryId, emoji = '☕'): Product {
  return {
    id: p.id,
    foodicsId: p.id,
    nameAr: p.name_localized || p.name,
    nameEn: p.name,
    descriptionAr: p.description_localized || p.description || '',
    descriptionEn: p.description || '',
    price: p.price,
    image: p.image ?? null,
    emoji,
    categoryId,
    calories: p.calories ?? undefined,
    sizes: [],
    addOns: [],
    isAvailable: p.is_active ?? true,
    isFeatured: false,
    tags: [],
    preparationTime: p.preparation_time ?? 5,
  };
}
