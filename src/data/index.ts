export { categories, categoryById } from './categories';
export {
  products,
  productById,
  featuredProducts,
  productsByCategory,
} from './menu';
export { branches, branchById, nearestBranch } from './branches';
export { coupons, couponByCode } from './coupons';
export { rewards } from './rewards';
export { giftDesigns, giftDesignById } from './giftDesigns';
export { offers } from './offers';
export type { Offer } from './offers';
export { faqItems } from './faq';
export type { FaqItem } from './faq';
export { mockNotifications } from './notifications';
export {
  mockUser,
  mockAddresses,
  mockOrders,
  mockWalletTx,
  mockGiftCards,
  INITIAL_WALLET_BALANCE,
  NOW_REF,
  DAY_MS,
} from './mock';
