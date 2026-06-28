# Sun Ray — Foodics Integration Plan

Status: **architecture alignment / frontend preparation only.** No real Foodics
integration, no credentials, and no backend are implemented yet. The Expo app
runs entirely on mock data and never calls Foodics. This document is the plan for
the future backend-based integration. Source of truth for the API: `.claude/FOODICS_API.md`.

---

## 1. What the mobile app handles

- All UI/UX: menu browsing, cart, customization (modifiers), checkout, order
  tracking, wallet, gift cards, loyalty, account.
- Building a **CheckoutPayload** (our DTO) and sending it to OUR backend.
- Showing order **stages** derived from Foodics status/deliveryStatus.
- Holding the **session token** for our backend (NOT a Foodics token).
- Identity = **customer phone**.

The app talks to exactly one system: **our backend** (`/api/*`). It never sees a
Foodics token, never calls `api.foodics.com`, and never processes real payments.

## 2. What the backend must handle

- Foodics **OAuth** (hold `client_id`/`client_secret`/access token + refresh).
- **Menu sync** from Foodics (categories, products, modifiers, branches, taxes),
  mapping Foodics UUIDs → our ids, exposing `/api/menu`, `/api/branches`.
- **Customer upsert** by phone (Foodics matches `country_code` + `phone`).
- **Order injection**: validate the CheckoutPayload, recalculate prices/taxes,
  build the Foodics order, `POST /orders`, store the mapping `internalRef ↔ foodicsOrderId`.
- **Webhook receiver** (`application.order.updated`, `customer.order.created`,
  `menu.updated`): respond `200` immediately, enqueue, process idempotently.
- **Loyalty Path A**: own the cup counter; issue a Foodics **Coupon** as the reward.
- **Gift cards**: sell an open-price Gift Card Product inside an order; return
  code + balance; balance lookups.
- **Payments**: integrate a PCI-compliant gateway; reconcile; default online
  orders to pay-at-branch (Foodics order injection accepts External(8) only,
  with Foodics approval).
- **Wallet**: stored balance + transactions (our DB, not a Foodics concept).
- Keep an **API-poll fallback** for missed webhooks.

## 3. Why the mobile app must NOT call Foodics directly

- The Foodics token / client secret is a **secret**. Anything in the Expo bundle
  (including `EXPO_PUBLIC_*`) ships to users and can be extracted → never put
  secrets in the app.
- Foodics scopes are broad; a leaked token could read/modify business data.
- Price/tax calculation, order injection, loyalty counting, and gift-card
  issuance must be **trusted/server-authoritative** (the client can be tampered with).
- Webhooks need a stable **SSL backend URL**, not a mobile device.

## 4. Required Foodics scopes (Path A)

`general.read`, `orders.limited.create`, `orders.list`, `orders.get`,
`customers.list`, `customers.get`, `customers.write`,
`orders.gift_cards.read`, `orders.gift_cards.write`, `coupons.read`, `coupons.write`.

We do **not** need `admin.write` for daily operation (gift card *products* are
created once, manually, in the Foodics console).

## 5. Online ordering flow

1. App syncs menu/branches from `/api/menu`, `/api/branches` (backend ← Foodics).
2. Customer builds a cart; app computes a display total (subtotal, VAT 15%,
   delivery fee, discount, total).
3. App `POST /api/orders` with a **CheckoutPayload** (type `2` pickup / `3` delivery,
   `internalRef`, items, customer phone, address for delivery).
4. Backend upserts the customer, recalculates prices/taxes, injects the Foodics
   order → it comes back **Pending** (source = API) in the cashier.
5. Branch accepts → backend receives `application.order.updated` → app sees
   stage move **Pending → Active (preparing) → Ready / En Route → Closed**.

Order type mapping: `pickup → 2`, `delivery → 3`, `dineIn → 1`, `driveThru → 4`.

## 6. Gift card flow

1. (once, manual) Open-price Gift Card Product created in the Foodics console.
2. App `POST /api/gift-cards` (amount + recipient).
3. Backend sells the Gift Card Product inside a Foodics order → reads the issued
   card `code` + `balance` → returns it.
4. App delivers the code to the recipient over a secure channel.
5. Balance lookup via `POST /api/gift-cards/lookup` (**code in the body, never in
   a URL/log** — a code is cash).

## 7. Loyalty flow (Path A — "buy 6 coffees, get the 7th free")

- **Our backend is the source of truth** for cup counters. Foodics' built-in
  loyalty is **amount-based**, not count-based, so it cannot count cups.
- Backend listens to `customer.order.created`, increments the customer's coffee
  cup counter (eligible categories: hot, cold, V60, matcha).
- At the goal (6), the backend issues a free-coffee reward as a Foodics **Coupon**;
  the customer gives the code to the cashier.
- Loyalty **requires the customer phone** as identity.
- The app mocks this today (`loyaltyStore.cupCount`, stamp card on the Loyalty tab).

## 8. Webhook flow

- Events: `application.order.updated`, `customer.order.created`, `menu.updated`.
- Rules: respond **`2xx` immediately** (≤5s), process in a background queue,
  idempotent by event id; **3 retries** then dropped → keep an API-poll fallback;
  100 non-2xx/min → blocked 1h. **SSL required.**
- `menu.updated` gives only `entity.type` + `entity.id` → backend GETs that entity
  and re-syncs.

## 9. Database tables needed later (backend)

- `customers` (our id, foodics_customer_id, phone, name).
- `loyalty_counters` (customer_id, product_scope, cup_count, updated_at).
- `loyalty_rewards` (customer_id, code, status, issued_at, redeemed_at).
- `gift_cards` (foodics_code, amount, last_known_balance, order_ref).
- `orders` (internal_ref, foodics_order_id, status, delivery_status, customer_id).
- `wallet_accounts` + `wallet_transactions`.
- `webhook_events` (raw log for idempotency + replay/fallback).

## 10. Sandbox verification checklist

- [ ] Account on Advanced plan / API license.
- [ ] App created with Foodics → `client_id`, `client_secret`, scopes, webhook URL.
- [ ] Every branch has correct lat/long + opening hours; a device receives online orders.
- [ ] SSL on the webhook URL.
- [ ] Open-price Gift Card Product created in the console.
- [ ] Order Tag per channel (`SunRayApp`).
- [ ] Confirm: selling a gift card inside `POST /orders` (exact field/shape).
- [ ] Confirm: applying a coupon / loyalty reward inside `POST /orders`.
- [ ] Confirm: tax model (inclusive vs exclusive) for the business.
- [ ] Confirm: refresh-token behavior + access-token lifetime.
- [ ] Confirm: `orders.limited.*` vs full `orders.*` granted to our app.
- [ ] Confirm: response envelope edge cases (`data` vs `order`).

## 11. Open questions before production

1. Exact `POST /orders` shape for selling a gift card and applying coupons/rewards.
2. Business tax configuration (drives the backend price/tax calculator).
3. Token lifetime + refresh flow.
4. Which payment methods we collect in-app vs pay-at-branch (External(8) approval).
5. Delivery: self-delivery (`PUT /orders/{id}` driver/delivery_status) vs aggregator.
6. Mapping table maintenance for Foodics category UUID → our `CategoryId`.

---

## App-side mapping reference

- `src/services/foodics.types.ts` — Foodics-aligned contract types + enums.
- `src/services/foodics.ts` — enums, scopes, webhook events, our↔Foodics mappers
  (pure, no network; backend-side logic mirrored for clarity).
- `src/services/{api,auth,menu,orders,loyalty,giftCards,wallet,payments}.ts` —
  typed interfaces to OUR backend (`/api/*`). They throw until the backend exists;
  the app keeps running on mock data.
