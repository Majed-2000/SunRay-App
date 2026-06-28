# Foodics API — Integration Knowledge Base

> Reference context for building a Node.js integration with Foodics POS.
> Compiled from the official docs at `apidocs.foodics.com` (v5).
>
> **How to use with Claude Code:** keep this file at the repo root (e.g. `FOODICS_API.md`)
> and reference it in prompts. It is the source of truth for endpoints, payloads, scopes,
> and the three product flows. When a fact is marked **[UNVERIFIED]** it must be confirmed
> against the sandbox before relying on it.

**Legend**
- ✅ **Confirmed** — taken directly from official Foodics docs.
- ⚠️ **[UNVERIFIED]** — best inference; verify on sandbox before shipping.
- 🔒 **Scope** — the OAuth scope required for that operation.

---

## 0. What we are building

Three products on top of one Foodics business:

1. **Online ordering** — customer orders via our menu → order is injected into Foodics → appears in the cashier.
2. **E-gift cards** — open-price, anonymous code, stored balance, redeemable at the branch.
3. **Loyalty (stamp card)** — "buy 6 coffees, get the 7th free", **visit-based / cumulative**, counted by *our* system (not Foodics).

Common foundation for all three: OAuth auth, our own database (customers, counters, codes), and **order webhooks as the engine** (confirm order, activate gift card, count cups).

---

## 1. Core API fundamentals ✅

| Item | Value |
|---|---|
| Production base URL | `https://api.foodics.com/v5` |
| Sandbox base URL | `https://api-sandbox.foodics.com/v5` |
| Current version | `v5` (ignore legacy `dash.foodics.com/api/v2`) |
| Auth header | `Authorization: Bearer ACCESS_TOKEN` |
| `Bearer` casing | **Case-sensitive.** Lowercase `bearer` → auth error. |
| Other headers | `Accept: application/json`, `Content-Type: application/json` |
| IDs | UUIDs (e.g. `8f7ab00a-d07d-4acc-...`) |
| Sandbox console (OAuth) | `console-sandbox.foodics.com` |

**Prerequisite (hard blocker):** the Foodics account must be on the **Advanced plan or hold an API license**, otherwise the API is not accessible. For a non-marketplace app the owner emails `support@foodics.com` from the owner email.

### Response envelope
- Single item: `{ "data": { ... } }`
- List: `{ "data": [ ... ], "meta": { "current_page", "last_page", "per_page", "total", "from", "to" } }`

> Note: a few endpoints (older `GET`/`List` order samples) wrap in `order` instead of `data`.
> `POST`/`PUT` consistently return `{ "data": ... }`. ⚠️ Confirm per-endpoint on sandbox.

### Request conventions (Laravel-style)
- **Filtering:** `?filter[branch_id]=...&filter[status]=1&filter[updated_after]=...`
- **Includes (relations):** `?include=category,modifiers`
- **Sorting:** `?sort=-created_at` (`-` = descending)
- **Pagination (general):** `?page=1&per_page=50` (per_page max **50**). Loop until `page > meta.last_page`.

### Rate limiting & errors ✅
- 429 `Too Many Attempts` when the per-operation limit is hit; `X-RateLimit-Limit` header shows the allowed rate. Respect `Retry-After` and back off.
- Standard HTTP codes: 401 (auth), 422 (validation), 429 (rate limit). Errors typically `{ "message", "errors" }`.

---

## 2. Authentication — OAuth 2.0 Code Grant ✅

Two integration models:

**A) API Adapter (simplest, single business):** the owner authorizes a registered party and selects branches; an access token for those branches is emailed. Good for one merchant / our own use.

**B) OAuth app (multi-tenant / marketplace):** full authorization-code flow below. `client_id` and `client_secret` are **issued by the Foodics team** when the app is created (not self-generated). Foodics also defines the app's scopes based on the integration's goals.

### Flow
1. User connects to the app from the Foodics apps store.
2. App requests authorization → user sees requested scopes on a consent screen.
3. On approval, Foodics redirects to the app's `redirect_uri` with an **authorization code**.
   - **Authorization code lifetime = 600 seconds.** Exchange it immediately.
4. App exchanges the code for an access token.

### Token exchange
`POST {base}/oauth/token`
```json
{
  "grant_type": "authorization_code",
  "code": "def50206ed2c3dff808d16ff54904e...",
  "client_id": "8f1ad782-3e35-4576-a0bb-d4f419b80a77",
  "client_secret": "wFakBkhMu7oIxWUPexHwLvdmx8romv52fucl5r8c",
  "redirect_uri": "https://yourapp.com"
}
```
Response:
```json
{ "token_type": "Bearer", "access_token": "eyJ0eXAiOiJKV1Qi..." }
```
- `redirect_uri` must match the one used during authorization.
- Access token is then used as `Authorization: Bearer <access_token>`.
- ⚠️ Token lifetime/refresh: a community OAuth client reports a 14-day access token with refresh via `offline_access`. The official Authentication page above does not restate this — **confirm refresh-token behavior with Foodics / on sandbox**.

### Identity & revoke
- `GET /whoami` → `{ user, business }` (id, name, email; business id/reference/name/owner/plan).
- **Revoke token:** deletes an active access token; revokes the app's ability to call APIs for that business. 🔒 `tokens.limited.revoke`.

---

## 3. Scopes (confirmed table — what we need) ✅

Scopes are `resource.action`, with `*.limited.*` variants for partial/scoped access (typically limited to the app's own data). An access token is restricted to granted scopes; calling outside them → authorization error.

**Most read/menu data is covered by a single scope: `general.read`.**

| Operation | Scope |
|---|---|
| Branches / Categories / Products / Modifiers / Combos / Groups (read) | `general.read` |
| Tax Groups / Taxes / Delivery Zones / Payment Methods / Discounts / Promotions (read) | `general.read` |
| Menu Display (read) | `general.read` |
| Menu writes (categories/products/modifiers/combos…) | `menu.write` |
| Customers list / get | `customers.list` / `customers.get` |
| Customers create / update | `customers.write` |
| Customer addresses | `customers.list` / `customers.get` / `customers.write` |
| Orders list | `orders.list` **or** `orders.limited.read` |
| Orders get | `orders.get` **or** `orders.limited.read` |
| Orders create | `orders.write` **or** `orders.limited.create` (**`orders.limited.pay`** if sending payments) |
| Orders update | `orders.write` **or** `orders.limited.deliver` **or** `orders.limited.decline` |
| Coupons read / write | `coupons.read` / `coupons.write` |
| Gift Card Products (read) | `general.read` |
| Gift Card Products (create/update/delete/restore) | **`admin.write`** (broad — do manually in console, not via app) |
| Gift Cards (get by code) | `orders.gift_cards.read` |
| Gift Card Transactions (read) | `orders.gift_cards.read` |
| Gift Card Transactions (create) | `orders.gift_cards.write` |
| Loyalty transactions / rewards (read) | `customers.loyalty.read` |
| Loyalty reward redeem (update) | `customers.loyalty.write` |
| Push notification (customer arrived) | `general.read` |

**Scopes our project needs (Path A loyalty):**
`general.read`, `orders.limited.create`, `orders.list`, `orders.get`,
`customers.list`, `customers.get`, `customers.write`,
`orders.gift_cards.read`, `orders.gift_cards.write`,
`coupons.read`, `coupons.write`.
**We do NOT need `admin.write`** for daily operation.

---

## 4. Webhooks ✅ (the engine for all three products)

Foodics pushes real-time events to our webhook URL instead of us polling.

### Events
| Event | Fires when |
|---|---|
| `order.created` | a new order is created |
| `order.updated` | any order property changes (**incl. status change**) |
| `order.delivery.created` | a new delivery order is created |
| `order.delivery.updated` | a delivery order property changes |
| `customer.order.created` | a new order **that has a customer** is created |
| `customer.order.updated` | an order with a customer changes |
| `application.order.updated` | an order **created by our app** changes (status, etc.) |
| `customer.created` | a new customer is created |
| `menu.updated` | any menu entity created/updated/deleted (category, product, modifier, modifier option, combo, group, price tag) |

### Registration
Provide a webhook URL + the subset of events when creating the app, or email `support@foodics.com` to configure it. **SSL is required** or webhooks won't be delivered.

### Handling rules (critical)
1. **Respond `2xx` immediately, before any processing.** Foodics does not read the response body; the webhook only delivers a notification. Push real work to a background queue.
2. **Timeout = 5 seconds.** No response in 5s → request dropped.
3. **Retries = 3 total** (1 initial + 2 retries). After the 3rd failure, that event is dropped → **do not rely solely on webhooks; keep an API-poll fallback.**
4. **Abuse block:** a webhook URL returning non-2xx for **100 requests within a minute** is **blocked for 1 hour** (all events lost during the block).

### Payload shape
```json
{
  "timestamp": 1603798700,
  "event": "order.updated",
  "business": { "name": "Happy Meal", "reference": 154543 },
  "order": { /* full order object, same shape as the Order resource */ }
}
```
- Customer events carry a `customer` object; menu events carry `entity`.

### `menu.updated` pattern
The event only gives `entity.type` + `entity.id` (no details). Fetch the entity to get changes:
```json
{ "event": "menu.updated", "entity": { "type": "category", "id": "906921e5-..." } }
```
→ call `GET /categories/906921e5-...`. `entity.type` ∈ {category, modifier, product, combo, group, pricetag}.
For `modifier`, the GET returns all its modifier options. `pricetag` events are buffered ~2 minutes (one webhook per price tag).

---

## 5. Core resources (focused on this project) ✅

### Branches — `GET /branches` 🔒 `general.read`
Fields incl. `id`, `name`, `latitude`, `longitude`, `opening_from`, `opening_to`, `reference`.
**Operational:** branches must have correct **lat/long** and **opening hours**, and a Foodics **device must be set to receive online orders**, or API orders won't reach the cashier.
Related: **Branch Business Days** 🔒 `operations.read`.

### Menu sync
- **Categories** — `GET /categories` 🔒 `general.read`
- **Products** — `GET /products` 🔒 `general.read` (write: `menu.write`). Useful filters: `category_id`, `branches.id`, `is_active`, `tags.id`, `sku`, `barcode`, `updated_after`. Includes: `category`, `modifiers`, `tags`, `groups`, `branches`, `ingredients`.
- **Modifiers / Modifier Options / Combos / Groups** — `general.read` to read.
- **Tax Groups / Taxes** — `GET /tax_groups`, `GET /taxes` 🔒 `general.read`.

### Menu Display — `GET /menu_display` 🔒 `general.read`
Returns **ordering/grouping structure only — no names, prices, or images.**
```json
{ "data": { "categories": [
  { "category_id": "906921e5", "children": [ { "child_id": "8fe62e4a", "child_type": "product" } ] }
] } }
```
`child_type` ∈ {product, combo, gift card, group}.
**Use it to order the menu the way the merchant arranged it**, then merge with details from `/products`, `/combos`, etc. (Update needs `admin.write` — not our concern.)

### Customers — `GET /customers` 🔒 `customers.list` (get: `customers.get`, write: `customers.write`)
Fields: `id`, `name`, `dial_code`, `phone`, `email`, `gender`, `birth_date`,
`is_blacklisted`, `is_house_account_enabled`, `house_account_limit`,
`is_loyalty_enabled`, `loyalty_balance` (read-only), `order_count`, `last_order_at`, `addresses`.
- **Upsert pattern:** when creating an order without a `customer_id`, Foodics matches by `country_code` + `phone`; if found it attaches, else creates a new customer.
- **Addresses** — `customers.*` scopes. Used for delivery (`customer_address_id`).

### Delivery Zones — `general.read`. Payment Methods — `general.read`.
- **Payment Methods:** the API accepts payments of type **External (8) only**, and sending payments via API requires Foodics approval (`support@foodics.com`). For cash/pay-at-branch, leave `payments` empty.

### Coupons — `GET /coupons` 🔒 `coupons.read` (create/update/delete: `coupons.write`)
**Fully creatable via API** — our reward mechanism for the loyalty "free coffee".

### Tags — `general.read` (write `tags.write`). Use **Order Tags** to segregate channels (e.g. "MyApp").

---

## 6. The Order object ✅ (the central entity)

### Enums
**Order types:** `1` Dine In · `2` Pick Up · `3` Delivery · `4` Drive Thru
**Order sources:** `1` Cashier · `2` API · `3` Call Center
**Order statuses:** `1` Pending · `2` Active · `3` Declined · `4` Closed · `5` Returned · `6` Joined · `7` Void · `8` Draft
**Delivery statuses:** `1` sent to kitchen · `2` ready · `3` assigned · `4` en route · `5` delivered · `6` closed
**Product statuses:** `1` Pending · `2` Active · `3` Closed · `4` Moved · `5` Void · `6` Returned · `7` Declined
**Discount types:** `1` Open · `2` Predefined · `3` Coupon · `4` Loyalty · `5` Promotion

> An order created via API comes back with `source = 2` and `status = 1 (Pending)`, and appears as **Pending** in the cashier for the restaurant to accept.

### Create Order — `POST /orders` 🔒 `orders.limited.create`
**You calculate prices and taxes** — send `unit_price`, `total_price`, per-line `taxes[]`, and order-level `subtotal_price` / `total_price` / `rounding_amount`. (The docs warn explicitly not to rely on sample values for calculations.)

Confirmed request body:
```json
{
  "guests": 3,
  "type": 1,
  "branch_id": "8f7ab00a",
  "discount_type": 2,
  "discount_id": "8f7b8e43",
  "discount_amount": 5,
  "kitchen_notes": "well done",
  "due_at": "2019-07-31 15:50:00",
  "table_id": "901a332a",
  "customer_notes": "some notes",
  "customer_address_id": "8fb30326",
  "customer_id": "8f89a6ad",
  "meta": { "3rd_party_order_number": "120153" },
  "charges": [
    { "charge_id": "8f98de52", "amount": 5, "tax_exclusive_amount": 5,
      "taxes": [ { "id": "8f7abcc6", "rate": 5, "amount": 0.23 } ] }
  ],
  "products": [
    {
      "product_id": "8f7bb4f5",
      "quantity": 1,
      "unit_price": 22,
      "discount_amount": 10,
      "discount_id": "8f7b8e43",
      "discount_type": 2,
      "meta": { "external_additional_product_info": "some info" },
      "options": [
        { "modifier_option_id": "8f7baae9", "quantity": 1, "unit_price": 2, "total_price": 2,
          "taxes": [ { "id": "8f7abcc6", "rate": 5, "amount": 0.09 } ] }
      ],
      "total_price": 16,
      "taxes": [ { "id": "8f7abcc6", "rate": 5, "amount": 1.04 } ]
    }
  ],
  "combos": [
    {
      "combo_size_id": "8f7be99c", "quantity": 2, "discount_type": 2, "discount_id": "8f7b8e43", "discount_amount": 10,
      "products": [
        { "product_id": "8f7bc5af", "combo_option_id": "8f7be9f9", "combo_size_id": "8f7be99c",
          "unit_price": 26, "quantity": 2, "total_price": 51.09,
          "options": [ { "modifier_option_id": "8f7baaae", "quantity": 1, "unit_price": 3, "total_price": 6, "taxes": [ { "id": "8f7abcc6", "rate": 5, "amount": 0.28 } ] } ],
          "taxes": [ { "id": "8f7abcc6", "rate": 5, "amount": 2.47 } ] }
      ]
    }
  ],
  "tags": [ { "id": "8fb90c71" } ],
  "payments": [
    { "amount": 91.25, "tendered": 91.25, "payment_method_id": "8f89c571", "tips": 0,
      "meta": { "external_additional_payment_info": "some info" } }
  ],
  "subtotal_price": 85.7,
  "rounding_amount": 0.05,
  "total_price": 91.25
}
```
Key points:
- Customer & address are passed **by id** (`customer_id`, `customer_address_id`) — not inline. Omit `customer_id` to trigger phone-match upsert.
- `meta.3rd_party_order_number` ties the Foodics order to our internal order id.
- `payments`: External (8) only + Foodics approval; omit for pay-at-branch.
- ⚠️ Tax model (inclusive vs exclusive) is business-configurable — the object exposes both `unit_price`/`total_price` and `tax_exclusive_*` fields. **Confirm the business setting on sandbox** before finalizing the tax calculator.

### Read / list / update
- `GET /orders/{id}` 🔒 `orders.get` — include `products`, `customer`, `payments`, `combos`, `charges`, `tags`, etc.
- `GET /orders` 🔒 `orders.list` — **special pagination** (see §7).
- `PUT /orders/{id}` 🔒 `orders.write` / `orders.limited.deliver` / `orders.limited.decline` — mainly the delivery lifecycle (`driver_id`, `delivery_status`, timestamps).

---

## 7. Orders pagination — SPECIAL ✅

**Do NOT paginate `/orders` with `page`** — it caps at **10 pages (500 orders)** then stops.
Instead, track the last processed `reference` and use:
```
GET /orders?sort=reference&filter[reference_after]=<last_reference>
```
Pass `0` the first time. Returns the next 50 orders after that reference.
(All other resources use normal `page`/`per_page` pagination.)

Useful order filters: `branch_id`, `status`, `type`, `source`, `customer_id`, `business_date_after/before`, `updated_after`, `reference_after`, `tags.id`, `has_terminal_payment`.

---

## 8. Product flow #1 — Online ordering ✅

**Setup (once / periodic)**
1. OAuth → access token.
2. Sync menu: branches, categories, products (+modifiers, combos), tax groups; order via `/menu_display`.
3. Register webhook URL + subscribe to `application.order.updated` (and `menu.updated`).

**At order time**
1. Customer builds a cart on our storefront.
2. **Upsert customer** → `customer_id` (+ create/find address → `customer_address_id` for delivery).
3. **Calculate** line prices, taxes, and totals.
4. `POST /orders` → returns order `source=2`, `status=1 (Pending)`.
5. Order shows **Pending** in the cashier; restaurant accepts.

**Follow-up (real-time)**
6. `application.order.updated` webhook on each change → respond `200` immediately → process in queue → update the customer (accepted / ready / en route / closed).
7. (optional pickup) customer arrived → `POST /devices/push_notifications` (below).
8. (optional self-delivery) `PUT /orders/{id}` with `delivery_status` + `driver_id`.

**Order Push Notification (customer arrived)** — `POST /devices/push_notifications` 🔒 `general.read`
```json
{ "event": "order_customer_arrived", "order_id": "969880a5-..." }
```
→ `200 OK`. (This notifies the cashier the customer arrived; it is **not** a status-update channel.)

---

## 9. Product flow #2 — E-gift cards ✅

Concept: gift cards are **prepaid stored-value** money. Sold as a product; **the sale is not reflected in sales reports**; the card is then usable as a payment method.

**Distinguish two objects:**
- **Gift Card Product** = the template/SKU (e.g. "Open-value e-gift"). Has `price` and `pricing_method` (`1` Fixed, `2` Open). Create/update needs **`admin.write`** → set up **once, manually in the console**.
- **Gift Card** = the individual issued card. Has `id`, `amount`, `balance`, `code`, linked `order` + `gift_card_product`. **Created only by selling a Gift Card Product inside an order** (there is no `POST /gift_cards`).

Our config: **one Open-price** Gift Card Product (`pricing_method = 2`), **anonymous code** (no customer link).

**Flow**
1. (once, manual) create the Open-price Gift Card Product in the console.
2. Customer pays for a card of amount `X` (online).
3. `POST /orders` selling the Gift Card Product at value `X` — **no customer needed**.
4. Foodics issues a card → read its `code` + `balance`.
5. Deliver the **code + balance** to the customer (email/SMS).
6. Any holder redeems at the branch; balance decreases.

**Read & redeem**
- `GET /gift_cards/{code}` 🔒 `orders.gift_cards.read` → `{ id, amount, balance, code, order, gift_card_product }`.
- **Gift Card Transactions** — `GET /gift_card_transactions` 🔒 `orders.gift_cards.read`; **create** `POST /gift_card_transactions` 🔒 `orders.gift_cards.write`:
  ```json
  { "amount": -180, "gift_card_id": "8cd1956b", "order_id": "8cd1956b" }
  ```
  → returns `old_balance`, `new_balance`. (Negative `amount` = redemption/decrement. In-store redemption usually happens automatically when the cashier applies the card as payment; this endpoint is available if we need to decrement programmatically.)

⚠️ **[UNVERIFIED]** Exact shape for selling a gift card inside `POST /orders` (whether the Gift Card Product goes in `products[]` like an open-price item with `unit_price = X`, or a dedicated field). **Test on sandbox.**

🔒 **Security:** the code is cash — any holder can spend it. Deliver over a secure channel (never in URLs/logs), prefer long random codes, and monitor balances via `GET /gift_cards/{code}`.

---

## 10. Product flow #3 — Loyalty: "6 coffees → 7th free" ✅

**Decision: visit-based / cumulative, counted by OUR system.** Even 7 cups in one order do not trigger the free cup in that same order — cups add to the customer's balance and the reward is redeemed as a **separate** step on a later visit. Loyalty therefore **requires identifying the customer (phone)** — unlike the anonymous gift cards.

### Why Foodics' built-in Loyalty does NOT fit
Foodics loyalty is **amount-based**, not count-based:
- Points are earned when an order's final price ≥ `loyaltyMinimumOrderPrice`; points live in the read-only customer attribute `loyalty_balance`; `is_loyalty_enabled` flags the customer.
- A redeemable **Loyalty Transaction** is created, redeemable only after `loyaltyDelayInHours`.
- When redeemed and total points ≥ `loyaltyRewardMinimum`, the customer gets a reward **in the form of a discount**.
- **All settings are configured in the Foodics console, read-only via API** (`customers.loyalty.read`). So we cannot make it count "cups" instead of "currency".

**Loyalty Reward object** (this is the redemption handshake Bonat-style integrations use):
```json
{ "id": "8f89b25c", "type": 1, "valid_to": "2021-01-04",
  "amount": 15, "maximum_discount_amount": 20, "code": "MOW4V4",
  "customer": { "id": "8f7bf6f9" }, "order": { "id": "8f91a4e8" } }
```
- `type` `1` = percentage, `2` = fixed. `code` = the redeem code.
- **Redeem** = `PUT /loyalty_rewards/{id}` with `{ "order_id": "..." }` 🔒 `customers.loyalty.write` (attaches the reward to an order so it applies).
- `GET /loyalty_transactions`, `GET /loyalty_rewards` 🔒 `customers.loyalty.read`.

### Two implementation paths
**Path A — our own counter + Coupons (RECOMMENDED, full control):**
1. Our DB tracks `customer → cup_count`.
2. On each `customer.order.created` webhook, check if the order contains a coffee product → increment the counter.
3. When count reaches 6, generate a **reward code** and create a Foodics **Coupon** for a free coffee (100% off / fixed) via `coupons.write`.
4. Customer gives the code to the cashier → applied as a coupon. Reset/decrement the counter.
- Pros: we fully control "every 6 cups" logic; uses API-creatable Coupons; no Foodics loyalty constraints.

**Path B — register as a Foodics Loyalty integration (Bonat-style):**
- Use the Loyalty Reward mechanism (reward `code` + `PUT /loyalty_rewards/{id}` with `order_id`).
- Cleaner cashier UX (cashier picks the loyalty integration, enters the code, Redeem), **but** requires a partner arrangement with Foodics, and we still own the cup counter (Foodics won't count cups).

**Recommendation:** start with **Path A**; move to Path B later if a smoother cashier experience is needed.

---

## 11. System architecture

- **Our system = source of truth** for customers, loyalty counters, gift-card/reward codes, and order mirror.
- **Foodics = POS** (menu, order acceptance, payments at branch).
- **Webhooks = the engine** wiring them together.

**Two directions:**
- **Earn / react:** `customer.order.created` / `application.order.updated` → confirm order, count cups, activate gift card.
- **Act:** `POST /orders` (inject order, sell gift card), `coupons` / `loyalty_rewards` (issue & redeem reward), `GET /gift_cards/{code}` (balance).

**Identity requirements per product:**
| Product | Identity |
|---|---|
| Online ordering | customer info for delivery; anonymous OK for pickup |
| E-gift card | **anonymous code** (no customer) |
| Loyalty | **customer phone required** |

**Suggested DB (minimum):**
- `customers` (our id, foodics_customer_id, phone, name).
- `loyalty_counters` (customer_id, product_scope, cup_count, updated_at).
- `loyalty_rewards` (customer_id, code, status, issued_at, redeemed_at).
- `gift_cards` (foodics_code, amount, last_known_balance, order_ref).
- `orders` (our_ref, foodics_order_id, status, customer_id).
- `webhook_events` (raw event log for idempotency + replay/fallback).

---

## 12. Open items to verify on sandbox ⚠️

1. **Selling a gift card inside `POST /orders`** — exact field/shape.
2. **Applying a coupon / loyalty reward inside `POST /orders`** — exact shape (order object shows `coupon` / `discount` as read relations; create-side shape unconfirmed).
3. **Tax model** (inclusive vs exclusive) for the business → drives the price/tax calculator.
4. **Refresh-token behavior** and access-token lifetime.
5. Whether our app is granted `orders.limited.*` (app-only) vs full `orders.*` — defined by Foodics at app creation.
6. Response envelope edge cases (`data` vs `order`) per endpoint.

---

## 13. Node.js client conventions (already scaffolded)

**FoodicsClient** essentials:
- `Authorization: Bearer <token>`, `Accept`/`Content-Type` JSON.
- `buildQuery({ filter, include, sort, page, per_page })` → `?filter[k]=v&include=a,b&sort=-created_at&page=1&per_page=50`.
- `request()` with **429 handling** (respect `Retry-After`, retry with backoff).
- `listAll(path, query)` → auto-paginate via `meta.last_page` (per_page 50). **Do not use for `/orders`** — use the `reference_after` strategy instead.
- Env: `FOODICS_ENV` (sandbox|production), `FOODICS_BASE_URL`, `FOODICS_TOKEN`.

**Webhook receiver pattern (mandatory):**
1. Verify SSL endpoint, accept `POST`.
2. **Return `200` immediately.**
3. Enqueue the event; process in a background worker (idempotent by event id).
4. Keep an **API-poll fallback** for missed events (3-retry cap).
5. Robust error handling to avoid the 100-error/min → 1-hour block.

---

## 14. Operational checklist

- [ ] Account on **Advanced plan / API license**.
- [ ] App created with Foodics → `client_id`, `client_secret`, scopes, `webhook_url`, `webhook_events`.
- [ ] Every branch has correct **lat/long** + **opening hours**.
- [ ] A Foodics **device** is set to receive online orders.
- [ ] **SSL** on the webhook URL.
- [ ] Open-price **Gift Card Product** created in console.
- [ ] **Order Tags** per channel (e.g. "MyApp").
- [ ] External payment method enabled (only if collecting payment via API).
- [ ] Gift-card codes treated as cash (secure delivery, monitoring).
