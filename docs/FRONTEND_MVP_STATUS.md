# Sun Ray · سن راي — Frontend MVP Status

**Phase:** Frontend MVP (mock-only) — **complete and verified on a real device.**
**Stack:** Expo SDK 54 · React Native 0.81.5 · React 19.1 · TypeScript 5.9 · Expo Router 6 · Zustand.
**Last checks:** `tsc --noEmit` → 0 errors · iOS bundle builds (~4.45 MB Hermes).

---

## 1. Current app status

A polished, Arabic‑first (RTL) cafe app running entirely on **mock data**. No backend,
no real Foodics calls, no real payments. The full customer journey works end‑to‑end on
device (iPhone via Expo Go), and the codebase is aligned to a future Foodics/backend
integration without containing any secrets or live calls.

- **36** route files · **32** screens · **32** reusable components · **11** Zustand stores · **10** service interfaces.
- TypeScript strict, single design system (`src/theme`), forced RTL with Eastern‑Arabic numerals.

## 2. Completed features

- **Onboarding & auth (mock):** splash, 3‑slide onboarding, language select, phone login (LTR phone field in an RTL app), OTP (any 4 digits).
- **Menu & ordering:** categories, product list/grid, product detail with modifiers (size / milk / extras / notes / qty), cart, coupons, fulfillment type (pickup/delivery/dine‑in), branch picker, address picker, scheduled time.
- **Checkout (mock):** 4 payment methods (wallet, card, Apple Pay, cash), wallet usage, points redemption, VAT 15% breakdown; order created as **Pending** then progresses Pending → Active → Ready / En Route → Closed.
- **Orders:** list (active/past), detail, live tracking with auto‑advancing status.
- **Loyalty:** points + tiers (bronze/silver/gold) and a Path‑A **coffee cup card** ("buy 6, get the 7th free") with rewards redemption.
- **Wallet:** balance, transaction history, mock top‑up.
- **Gift cards:** browse/create with live preview, “My Cards” (full‑width preview), and **redeem → credits recipient wallet** (mock); codes treated as cash and never placed in URLs.
- **Notifications Center:** mock feed (order accepted/ready, points, gift received, birthday) with unread badge + empty state.
- **Account:** profile, **edit profile** (name, email, gender, city, birth day/month — no year, for birthday offers), addresses (+ add), settings, support, FAQ.
- **Extras:** reserve‑a‑table and waitlist flows.
- **Responsive:** phone‑first; tablet/iPad uses wider grids and centered max‑width layouts (menu grid, product, cart, checkout).
- **States:** loading (simulated), error + retry, and empty states across cart, orders, addresses, gift cards, coupons, menu, notifications.

## 3. Screens completed

Auth: Splash, Onboarding, Language, Login, OTP.
Main tabs: Home, Menu, Orders, Loyalty, Account.
Ordering: Product detail, Cart, Checkout, Order success, Order detail, Order tracking.
Wallet: Wallet, Top‑up, History.
Gift: Gift list, Gift create, Gift detail.
Other: Notifications, Offers/coupons, Reserve, Waitlist, Addresses, Add address, Edit profile, Settings, Support, FAQ.

## 4. Mock-only areas (no real integration)

- Auth/OTP: any 4‑digit code signs in the demo user; no SMS.
- Payments/checkout: no charge or order injection — local mock only.
- Orders/tracking: status progression simulated by a timer.
- Wallet, loyalty counters, gift cards, notifications: in‑memory Zustand state (reset on full app restart).
- Loading/error states: simulated latency; mock loads do not fail by default.
- Product images: emoji/striped placeholders.

## 5. Foodics-safe architecture summary

- The app talks **only to our future backend** (`/api/*`); it never calls Foodics and never holds a Foodics token/secret. See `.claude/FOODICS_API.md` and `docs/FOODICS_INTEGRATION_PLAN.md`.
- `src/services/foodics.types.ts` — Foodics‑aligned contract types + numeric enums (order type 1–4, order status 1–8, delivery status 1–6).
- `src/services/foodics.ts` — enums, required scopes (Path A), webhook events, and pure our↔Foodics mappers (no network).
- `src/services/{api,auth,menu,orders,loyalty,giftCards,wallet,payments}.ts` — typed interfaces to our backend that **throw until wired**, so the app cleanly falls back to mock data.
- Order model already carries Foodics numerics (`status`, `deliveryStatus`, `foodicsOrderId`) with a UI‑level `OrderStage` derived for display.
- Loyalty is **Path A** (our backend owns the cup counter; reward issued as a Foodics Coupon). Gift cards top up the recipient wallet; real issuance/redemption is backend‑side.
- No secrets in the app; `.env.example` documents the secret‑free `EXPO_PUBLIC_API_BASE_URL`.

## 6. Known limitations

- All data is mock and non‑persistent (no AsyncStorage persistence yet) — state resets on cold start.
- No real auth, payments, order submission, push notifications, or live menu/branch sync.
- Tablet product detail is centered with a larger hero (not a true two‑pane split).
- English locale is scaffolded (`src/i18n`) but currently aliased to Arabic; app is Arabic‑only for now.
- Mock business rules (VAT, fees, loyalty thresholds, cities) live in `src/constants/config.ts` and should be confirmed with the business.

## 7. Recommended next phase (Backend integration)

1. Stand up the backend that owns the Foodics OAuth token and exposes `/api/*` (+ `/foodics/*` proxy, webhook receiver with SSL).
2. Implement `src/services/*` against it: menu/branches sync, customer upsert by phone, order injection (Pending), order status via `application.order.updated` webhooks.
3. Wire real OTP (SMS provider) and a PCI‑compliant payment gateway (default online orders to pay‑at‑branch).
4. Implement Path‑A loyalty counter + coupon issuance, and gift‑card sale/redemption (wallet credit) server‑side.
5. Add client persistence (AsyncStorage), push notifications, real product photography, and enable the English locale.
6. Verify on the Foodics sandbox using the checklist in `docs/FOODICS_INTEGRATION_PLAN.md`.

## 8. Device QA notes

- Verified on a real iPhone via **Expo Go (SDK 54)** over an Expo tunnel (works across networks).
- Fixed from real‑device QA: phone input now renders **LTR** with correct grouping in the RTL app; notification bell opens the Notifications Center; menu category pills are compact, not clipped, and no longer overlap the grid after load; gift CTA wording + “My Cards” layout; gift→wallet redemption; edit‑profile fields (gender/city/birthday).
- Project SDK was aligned to **54** to match public Expo Go (it was on SDK 56, which Expo Go didn’t support yet).

## 9. Commands to run the app

```bash
npm install            # .npmrc sets legacy-peer-deps automatically
npm start              # or: npx expo start
# same Wi-Fi not available? use a public tunnel:
npx expo start --tunnel

npm run typecheck      # tsc --noEmit
npx expo export -p ios # bundle/check
```

Open in **Expo Go**: scan the QR or enter the `exp://…` URL manually.
Demo tips: OTP = any 4 digits; login = any Saudi number (or continue as guest).
