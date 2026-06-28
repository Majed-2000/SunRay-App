import {
  FoodicsOrderType,
  FoodicsOrderStatus,
  FoodicsDeliveryStatus,
} from '@/services/foodics.types';

// Re-export the Foodics-aligned enums as the app's canonical order model so
// screens/stores import them from a single place.
export {
  FoodicsOrderType,
  FoodicsOrderStatus,
  FoodicsDeliveryStatus,
} from '@/services/foodics.types';
export type { OrderStage } from '@/services/foodics.types';

/** Numeric Foodics order status (1=Pending … 8=Draft). */
export type OrderStatus = FoodicsOrderStatus;
/** Numeric Foodics delivery status (1=SentToKitchen … 6=Closed). */
export type DeliveryStatus = FoodicsDeliveryStatus;

// ───────────────────────── Menu ─────────────────────────
// The known mock category keys. Real backend categories use opaque string ids,
// so `Category.id`/`Product.categoryId` are typed as `string` (not this union).
export type CategoryId =
  | 'hot'
  | 'cold'
  | 'v60'
  | 'matcha'
  | 'bakery'
  | 'dessert'
  | 'sandwiches'
  | 'water';

export interface Category {
  id: string; // mock uses CategoryId keys; backend uses opaque ids
  foodicsId: string; // maps to a Foodics category UUID
  nameAr: string;
  nameEn: string;
  emoji: string;
}

export interface ProductSize {
  id: string;
  foodicsId: string; // Foodics modifier option id (size group)
  labelAr: string;
  labelEn: string;
  priceDelta: number; // added to base price
}

export interface ProductAddOn {
  id: string;
  foodicsId: string; // Foodics modifier option id
  labelAr: string;
  labelEn: string;
  priceDelta: number;
  group: 'milk' | 'extra'; // milk = single-select, extra = multi-select
}

export interface Product {
  id: string;
  foodicsId: string; // maps to a Foodics product UUID
  nameAr: string;
  nameEn: string;
  descriptionAr: string;
  descriptionEn: string;
  price: number; // base price (﷼)
  image: string | null; // null → placeholder
  emoji: string; // placeholder visual
  categoryId: string; // references Category.id (mock key or backend id)
  calories?: number;
  sizes: ProductSize[]; // app-flattened view of Foodics "size" modifier options
  addOns: ProductAddOn[]; // app-flattened view of other Foodics modifier options
  isAvailable: boolean; // mirrors Foodics product is_active
  isFeatured: boolean;
  tags: string[];
  preparationTime: number; // minutes
  rating?: number;
}

// ───────────────────────── Cart ─────────────────────────
export interface CartLine {
  id: string; // unique line key (product + options signature)
  productId: string;
  nameAr: string;
  nameEn: string;
  emoji: string;
  optionLabel: string; // human readable "وسط · حليب لوز"
  sizeId?: string;
  addOnIds: string[];
  notes?: string;
  unitPrice: number;
  qty: number;
}

// ───────────────────────── Branches & Addresses ─────────────────────────
export interface Branch {
  id: string;
  foodicsId: string; // maps to a Foodics branch UUID
  nameAr: string;
  nameEn: string;
  areaAr: string; // district / city line
  addressAr: string;
  lat: number;
  lng: number;
  isOpen: boolean;
  hoursAr: string;
  openingFrom: string; // "HH:MM:SS" — Foodics opening_from
  openingTo: string; // "HH:MM:SS" — Foodics opening_to
  distanceKm: number;
  supportsDelivery: boolean;
  supportsDineIn: boolean;
}

export type AddressLabel = 'home' | 'work' | 'other';

export interface Address {
  id: string;
  label: AddressLabel;
  titleAr: string;
  detailsAr: string;
  lat?: number;
  lng?: number;
  isDefault: boolean;
}

// ───────────────────────── Orders ─────────────────────────
/**
 * App fulfillment type (UI-friendly). Maps to a Foodics numeric order type:
 * pickup → 2 (PickUp), delivery → 3 (Delivery), dineIn → 1 (DineIn).
 * See `toFoodicsOrderType` in services/foodics.ts.
 */
export type OrderType = 'pickup' | 'delivery' | 'dineIn';

export type PaymentMethod = 'wallet' | 'card' | 'applePay' | 'cash';

export interface OrderItemSnapshot {
  nameAr: string;
  optionLabel: string;
  qty: number;
  lineTotal: number;
}

export interface Order {
  id: string; // internal reference, e.g. SR-1234
  foodicsOrderId: string | null; // Foodics order UUID — null until backend injects it
  createdAt: number; // epoch ms
  type: OrderType;
  status: OrderStatus; // Foodics order status (1=Pending … 8=Draft)
  deliveryStatus: DeliveryStatus | null; // Foodics delivery status (delivery orders)
  branchId: string;
  addressId?: string;
  items: OrderItemSnapshot[];
  subtotal: number;
  vat: number;
  deliveryFee: number;
  discount: number;
  total: number;
  paymentMethod: PaymentMethod;
  pointsEarned: number;
  etaMinutes: number;
}

// ───────────────────────── Wallet ─────────────────────────
export type WalletTxType = 'topup' | 'payment' | 'refund' | 'giftPurchase' | 'reward';

export interface WalletTransaction {
  id: string;
  type: WalletTxType;
  amount: number; // positive = credit, negative = debit
  titleAr: string;
  createdAt: number;
}

// ───────────────────────── Gift Cards ─────────────────────────
export interface GiftDesign {
  id: string;
  nameAr: string;
  gradient: readonly [string, string];
  shadowColor: string;
  labelColor: string;
}

export type GiftStatus = 'active' | 'used' | 'expired';

export interface GiftCard {
  id: string;
  code: string; // generated mock code
  amount: number;
  designId: string;
  senderName: string;
  recipientName: string;
  recipientPhone: string;
  message: string;
  status: GiftStatus;
  createdAt: number;
  direction: 'sent' | 'received';
}

// ───────────────────────── Loyalty ─────────────────────────
export type LoyaltyTier = 'bronze' | 'silver' | 'gold';

export type RewardKind = 'discount' | 'freeItem' | 'sizeUpgrade' | 'walletTopup';

export interface Reward {
  id: string;
  nameAr: string;
  nameEn: string;
  emoji: string;
  cost: number; // points
  kind: RewardKind;
  value?: number; // discount % or wallet ﷼ etc.
}

// ───────────────────────── Coupons ─────────────────────────
export type CouponKind = 'percent' | 'fixed';

export interface Coupon {
  code: string;
  kind: CouponKind;
  value: number; // percent (0-100) or fixed ﷼
  titleAr: string;
  descriptionAr: string;
  appliesToCategory?: CategoryId; // limit to a category
  minSubtotal?: number;
  firstOrderOnly?: boolean;
}

// ───────────────────────── Notifications ─────────────────────────
export type NotificationType =
  | 'orderAccepted'
  | 'orderReady'
  | 'pointsEarned'
  | 'giftReceived'
  | 'birthdayOffer';

export interface AppNotification {
  id: string;
  type: NotificationType;
  titleAr: string;
  bodyAr: string;
  createdAt: number;
  read: boolean;
}

// ───────────────────────── User ─────────────────────────
export type Gender = 'male' | 'female';

export interface User {
  id: string;
  name: string;
  phone: string; // local form, e.g. 501234567
  email?: string;
  gender?: Gender;
  city?: string;
  /** Birthday without a year — used for future birthday offers. */
  birthDay?: number; // 1–31
  birthMonth?: number; // 1–12
  avatarText: string; // initial(s) for avatar
  joinedAt: number;
}
