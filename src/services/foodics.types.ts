/**
 * Foodics-aligned contract types — the shapes our FUTURE backend will expose to
 * this app over a plain REST API (`/api/*`). They are adapted for frontend use
 * (camelCase, only the fields the app needs) and modeled on `.claude/FOODICS_API.md`.
 *
 * These are PURE TYPES + enums. No secrets, no network, no Foodics calls.
 * The mobile app talks only to our backend; the backend talks to Foodics.
 */

// ───────────────────────── Foodics enums (numeric, as in the API) ─────────────────────────
/** Order types — `.claude/FOODICS_API.md §6`. */
export enum FoodicsOrderType {
  DineIn = 1,
  PickUp = 2,
  Delivery = 3,
  DriveThru = 4,
}

/** Order sources — an order created via API comes back as `API`. */
export enum FoodicsOrderSource {
  Cashier = 1,
  API = 2,
  CallCenter = 3,
}

/** Order statuses — the Foodics order lifecycle. */
export enum FoodicsOrderStatus {
  Pending = 1,
  Active = 2,
  Declined = 3,
  Closed = 4,
  Returned = 5,
  Joined = 6,
  Void = 7,
  Draft = 8,
}

/** Delivery statuses — only meaningful for delivery (type 3) orders. */
export enum FoodicsDeliveryStatus {
  SentToKitchen = 1,
  Ready = 2,
  Assigned = 3,
  EnRoute = 4,
  Delivered = 5,
  Closed = 6,
}

/** Discount types — used when a coupon / loyalty reward is applied. */
export enum FoodicsDiscountType {
  Open = 1,
  Predefined = 2,
  Coupon = 3,
  Loyalty = 4,
  Promotion = 5,
}

/**
 * Customer-facing order stage the UI renders. Derived from
 * (status, deliveryStatus, type) — see `orderStage()` in the order store.
 */
export type OrderStage = 'pending' | 'preparing' | 'ready' | 'enRoute' | 'completed' | 'cancelled';

// ───────────────────────── Menu ─────────────────────────
export interface Branch {
  id: string; // our internal id
  foodicsId: string; // Foodics branch UUID
  nameAr: string;
  nameEn: string;
  latitude: number;
  longitude: number;
  openingFrom: string; // "HH:MM:SS"
  openingTo: string; // "HH:MM:SS"
  isOpen: boolean;
  supportsDelivery: boolean;
  supportsDineIn: boolean;
}

export interface Category {
  id: string;
  foodicsId: string;
  nameAr: string;
  nameEn: string;
}

export interface ModifierOption {
  id: string;
  foodicsId: string;
  nameAr: string;
  nameEn: string;
  price: number; // added to the product price
}

/** A modifier is a group of options (e.g. "Size", "Milk") attached to a product. */
export interface Modifier {
  id: string;
  foodicsId: string;
  nameAr: string;
  nameEn: string;
  isMultiSelect: boolean; // false = single-choice (e.g. size/milk)
  isRequired: boolean;
  minOptions: number;
  maxOptions: number;
  options: ModifierOption[];
}

export interface Product {
  id: string;
  foodicsId: string;
  categoryId: string;
  nameAr: string;
  nameEn: string;
  descriptionAr: string;
  descriptionEn: string;
  price: number;
  image: string | null;
  isActive: boolean;
  calories?: number;
  preparationTime: number;
  modifiers: Modifier[];
}

// ───────────────────────── Cart & checkout (frontend → backend) ─────────────────────────
/** A selected cart line. Prices are advisory; the BACKEND recalculates & taxes. */
export interface CartItem {
  productId: string;
  quantity: number;
  modifierOptionIds: string[];
  unitPrice: number; // for display only
  notes?: string;
}

export interface CheckoutTotals {
  subtotal: number;
  vat: number;
  deliveryFee: number;
  discount: number;
  total: number;
}

/**
 * Body the app POSTs to `POST /api/orders`. The backend validates, recalculates
 * prices/taxes, builds the real Foodics order, injects it, and returns an `Order`.
 */
export interface CheckoutPayload {
  internalRef: string; // our order reference, e.g. SR-1234
  type: FoodicsOrderType; // 2 = Pick Up, 3 = Delivery
  branchId: string;
  customerPhone: string; // identity by phone (required for loyalty)
  customerAddressId?: string; // delivery only
  notes?: string;
  items: CartItem[];
  couponCode?: string;
  payment: {
    method: 'wallet' | 'card' | 'applePay' | 'cash';
    useWallet: boolean;
    redeemPoints: boolean;
  };
  totals: CheckoutTotals;
}

// ───────────────────────── Orders ─────────────────────────
export interface OrderItemLine {
  nameAr: string;
  optionLabel: string;
  quantity: number;
  lineTotal: number;
}

export interface Order {
  id: string; // our internal id == internalRef
  internalRef: string;
  foodicsOrderId: string | null; // null until the backend injects it into Foodics
  createdAt: number;
  type: FoodicsOrderType;
  status: FoodicsOrderStatus;
  deliveryStatus: FoodicsDeliveryStatus | null;
  branchId: string;
  customerPhone?: string;
  items: OrderItemLine[];
  totals: CheckoutTotals;
  pointsEarned: number;
  etaMinutes: number;
}

// ───────────────────────── Customers ─────────────────────────
export interface CustomerAddress {
  id: string;
  titleAr: string;
  detailsAr: string;
  latitude?: number;
  longitude?: number;
}

export interface Customer {
  id: string;
  foodicsCustomerId: string | null;
  name: string;
  countryCode: string; // e.g. "+966"
  phone: string; // local form — matching key for Foodics upsert
  email?: string;
  loyaltyBalance: number; // read-only mirror
  addresses: CustomerAddress[];
}

// ───────────────────────── Gift cards ─────────────────────────
export type GiftCardStatus = 'active' | 'used' | 'expired';

export interface GiftCard {
  /** Foodics gift card code — treat as CASH. Never put in URLs, query strings, or logs. */
  code: string;
  amount: number;
  balance: number;
  status: GiftCardStatus;
  foodicsGiftCardId: string | null;
  createdAt: number;
}

// ───────────────────────── Loyalty (Path A — our counter) ─────────────────────────
/** Our backend is the source of truth for cup counters (Foodics loyalty is amount-based). */
export interface LoyaltyCounter {
  customerPhone: string;
  productScope: string; // e.g. "coffee"
  cupCount: number;
  goal: number; // e.g. 6 → 7th free
  updatedAt: number;
}

export interface LoyaltyReward {
  id: string;
  /** Reward redemption code — issued as a Foodics Coupon (Path A). */
  code: string;
  status: 'issued' | 'redeemed' | 'expired';
  description: string;
  issuedAt: number;
  redeemedAt: number | null;
}

// ───────────────────────── Coupons ─────────────────────────
export interface Coupon {
  code: string;
  /** 'percent' or 'fixed' discount applied at the branch / on the order. */
  kind: 'percent' | 'fixed';
  value: number;
  titleAr: string;
  descriptionAr: string;
}
