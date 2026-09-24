/**
 * Feature switches for things the app can render but the business does not
 * currently offer.
 *
 * These are not experiments. Each one guards a flow that exists in this
 * codebase, works, and would mislead a customer if shown — because the store
 * behind it cannot fulfil the promise.
 */

/**
 * Delivery and dine-in.
 *
 * The app was built with a three-way order type (pickup · delivery · dine-in),
 * a delivery fee, a free-delivery threshold, an address book and a courier
 * tracking screen. The store supports **none of it**: `createStoreOrder`
 * accepts `pickup` and `car` only, there is no delivery mode anywhere in
 * `store_payments.js`, and the store's own pages state it plainly —
 * «استلام من الفرع أو خدمة السيارة — لا يوجد توصيل».
 *
 * Left off rather than deleted, at the owner's decision, so the work survives
 * if delivery is introduced later.
 *
 * ⚠️ Flipping this to `true` is NOT enough to ship delivery. The server has to
 * learn the mode first: today a delivery order would be recorded as a pickup
 * and nobody would drive anywhere. Treat this as "the screens are ready", not
 * "the service is ready".
 */
export const STORE_HAS_DELIVERY = false;

/**
 * Apple Pay.
 *
 * Supported by `react-native-moyasar-sdk`, but it needs an Apple developer
 * merchant identifier and an entitlement that only exists in an iOS build. We
 * ship an Android APK, so the button would be dead weight.
 */
export const STORE_HAS_APPLE_PAY = false;

/**
 * Table reservation («حجز جلسة»).
 *
 * `ReserveScreen` confirms a booking with no network call at all — the customer
 * is told «تم تأكيد حجزك» and nothing, anywhere, knows about it. Off until the
 * store has a booking endpoint to call.
 */
export const STORE_HAS_RESERVATION = false;

/**
 * Walk-in waitlist («انتظار»).
 *
 * `WaitlistScreen` shows a position, a queue length and a wait time that are
 * constants in the file. Off until a real queue backs it.
 */
export const STORE_HAS_WAITLIST = false;
