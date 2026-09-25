// What remains here is not menu or business data — that is all live from the
// store now. Gift designs and FAQ copy are app content; the mock* exports back
// the wallet, gift-card and address screens, which stay switched off
// (constants/features.ts) until they are real.
export { giftDesigns, giftDesignById } from './giftDesigns';
export { faqItems } from './faq';
export type { FaqItem } from './faq';
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
