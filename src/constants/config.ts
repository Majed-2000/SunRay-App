/**
 * Constants that genuinely belong to the app.
 *
 * Everything that describes the *business* has been removed from here, because
 * a shipped copy of a business number goes stale silently — the customer is
 * quoted a fee the server does not charge, or shown a goal that no longer
 * exists. What left, and where it lives now:
 *
 *   FREE_DRINK_AT · LOYALTY_CUP_GOAL · TIER_THRESHOLDS · POINTS_REDEEM_RATE
 *   COFFEE_CATEGORY_IDS · POINTS_PER_RIYAL
 *       → invented outright. The programme is one point per riyal with a
 *         threshold the server withholds until an admin confirms it. See
 *         `services/storeLoyalty.ts`.
 *
 *   GIFT_AMOUNT_PRESETS → `store/config/giftPackages`
 *   DELIVERY_FEE · FREE_DELIVERY_THRESHOLD · VAT_RATE
 *       → the server stamps `vatRate` and the fees onto each order and
 *         recomputes the total from the catalog before charging. The app
 *         displays what it is told.
 *
 * What remains is either a fact about Saudi Arabia or a purely local default.
 */
export const CONFIG = {
  /**
   * KSA VAT. Kept only to render a tax line on a cart that has not been priced
   * by the server yet; every settled order carries its own `vatRate`, and that
   * is what an invoice must show.
   */
  VAT_RATE: 0.15,
  /** Menu prices are VAT-inclusive — the server extracts tax from the net. */
  PRICES_INCLUDE_VAT: true,

  /** Wallet top-up chips. A local convenience, not a business rule. */
  WALLET_TOPUP_PRESETS: [50, 100, 200],

  CURRENCY: 'SAR',
  COUNTRY_DIAL_CODE: '+966',
} as const;
