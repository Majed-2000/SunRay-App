/**
 * App-wide tunable constants (mock business rules). Safe to adjust later or
 * move server-side. No secrets here.
 */
export const CONFIG = {
  // Tax & fees
  VAT_RATE: 0.15, // KSA VAT 15% — shown as a separate cart line
  PRICES_INCLUDE_VAT: false, // menu prices treated as pre-VAT for a clear VAT line
  DELIVERY_FEE: 15, // flat delivery fee (﷼); 0 for pickup
  FREE_DELIVERY_THRESHOLD: 120, // subtotal above this → free delivery

  // Loyalty
  POINTS_PER_RIYAL: 1, // earn 1 point per 1 ﷼ spent
  FREE_DRINK_AT: 200, // points needed for the next free drink milestone
  TIER_THRESHOLDS: { bronze: 0, silver: 500, gold: 1500 }, // lifetime points
  POINTS_REDEEM_RATE: 0.1, // ﷼ value per point when redeeming in cart (10 pts = 1 ﷼)

  // Loyalty — Path A cup card ("buy 6 coffees, get the 7th free").
  // Counted by OUR backend (Foodics loyalty is amount-based, not cup-based).
  LOYALTY_CUP_GOAL: 6, // cups needed before a free coffee
  COFFEE_CATEGORY_IDS: ['hot', 'cold', 'v60', 'matcha'] as const, // eligible categories

  // Wallet
  WALLET_TOPUP_PRESETS: [50, 100, 200],

  // Gift cards
  GIFT_AMOUNT_PRESETS: [50, 100, 300],
  GIFT_CODE_PREFIX: 'SR',

  // Currency
  CURRENCY: 'SAR',
  COUNTRY_DIAL_CODE: '+966',
} as const;
