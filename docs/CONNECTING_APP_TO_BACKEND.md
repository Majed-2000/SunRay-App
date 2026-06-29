# Connecting the Expo app to the local backend

This connects: Auth (login/verify/**refresh/logout/me**), Branches, Menu, Product
details, and Orders to the backend with **real token-based auth**. Wallet, loyalty,
gift cards, and notifications are still mock on the app.

The app uses a **feature flag**: when `EXPO_PUBLIC_USE_BACKEND` is `false` (default) it uses
mock data and never calls the backend. When `true` (with a reachable URL) the connected
areas load from the backend instead.

> **Security model:** see `backend/SECURITY.md`. In short: verify returns a short-lived
> access token + a long-lived refresh token. The app stores the refresh token in
> **expo-secure-store**, auto-attaches the access token to every request, and on a 401
> transparently refreshes + retries. Identity is derived from the token server-side — the
> app no longer sends `customerId`. See the **Auth & sessions** section below.

---

## Step 1 — Run the backend

```bash
cd backend
npm run dev
```
Confirm it works by opening this in your computer's browser:
```
http://localhost:4000/health
```
You should see `{"ok":true,"data":{"status":"ok",...}}`.

## Step 2 — Find your computer's LAN IP (Windows)

> ⚠️ On a **real phone**, `localhost` means the **phone itself**, not your PC. You must use
> your computer's address on the Wi-Fi network instead.

In **PowerShell** run:
```powershell
ipconfig
```
Look for **IPv4 Address** under your active Wi-Fi adapter, for example:
```
IPv4 Address. . . . . . . . . . . : 192.168.1.8
```
Your phone and PC must be on the **same Wi-Fi**.

## Step 3 — Point the app at the backend

In the **app root** (`ReCa-App/`), create a `.env` file (copy from `.env.example`) with:
```
EXPO_PUBLIC_API_BASE_URL=http://192.168.1.8:4000   # use YOUR IPv4 from step 2
EXPO_PUBLIC_USE_BACKEND=true
```
(If you test on a **simulator/emulator** on the same PC, you can use `http://localhost:4000`.)

## Step 4 — Run the app

```bash
npx expo start
```
Open it in Expo Go. Env vars are read at startup, so if you change `.env`, **restart**
`expo start` (press `r` to reload, or stop and start again).

---

## What to expect when connected

- **Login → OTP:** entering a phone calls `POST /api/auth/login`; entering any 4 digits
  calls `POST /api/auth/verify`, which returns an **access token + refresh token + customer**.
  The app keeps you signed in across restarts and refreshes the token automatically.
- **Home / Menu:** categories and products load from `GET /api/menu` (you'll see a brief
  loading spinner, then the real seeded items). Branches load from `GET /api/branches`.
- **Product details:** options (size/milk) come from the backend product's modifiers.
- **Orders (this phase):** checkout submits to `POST /api/orders` (the **backend** computes
  subtotal/VAT/delivery/total); "طلباتي" loads from `GET /api/orders`; order detail and
  tracking load from `GET /api/orders/:id`. The success screen shows a short reference like
  `SR-AB12C` derived from the real order id.
- If the backend is **unreachable**, the Menu/Orders show a friendly error with a **Retry**
  button, and checkout/login show a toast — the app won't crash.

---

## Testing the ORDERS flow (backend mode)

1. Log in (`501234567` / `1234`), open the **Menu**, add a product to the cart, go to **Checkout**.
2. Tap **أكمل الطلب / اطلب التوصيل**. Watch the backend terminal print `POST /api/orders → 201`.
   The success screen shows the order reference.
3. Open **طلباتي** → your order appears (from `GET /api/orders`). Open it → **order detail**
   (from `GET /api/orders/:id`). For a delivery order, open **tracking**.
4. **Advance the status** (DEV/ADMIN only — `PATCH /api/orders/:id/status` now requires
   auth and is allowed only in development or with `ADMIN_ENABLED=true`):
   - In the app: the **"تقديم الحالة (اختبار)"** button shows only in dev builds (`__DEV__`)
     and sends the request with your token automatically.
   - Or from your PC with curl — you need a **Bearer access token** (copy `accessToken`
     from the `verify` response) and the order must be **yours**:
     ```bash
     curl -X PATCH http://localhost:4000/api/orders/<ORDER_ID>/status \
       -H "Authorization: Bearer <ACCESS_TOKEN>" \
       -H "Content-Type: application/json" -d '{"status":"READY"}'
     ```
     The tracking screen **polls every 3s**, so the new status appears automatically.
   Valid statuses: `PENDING ACCEPTED PREPARING READY EN_ROUTE COMPLETED CANCELLED`.

**Still mock even in backend mode:** wallet, loyalty, gift cards, notifications, coupons, and
the payment-method choice (cosmetic — checkout never performs a real payment). **Guests must
log in to order:** in backend mode, continue-as-guest can browse but is routed to login at
checkout (the cart is preserved). There are no anonymous orders.

---

## Auth & sessions (security hardening)

| What | How |
|------|-----|
| Tokens | access JWT (~15m) + rotating refresh token (~30d) |
| Storage | refresh token in **expo-secure-store**; access token in memory |
| Every request | `Authorization: Bearer <access>` attached automatically |
| Expired access | client calls `POST /api/auth/refresh`, then retries the request once |
| Refresh fails | session ends → routed to login (cart & local state preserved) |
| Cold start | `restoreSession()` → `GET /api/auth/me` keeps you logged in |
| Logout | `POST /api/auth/logout` revokes the session immediately (server-side) |
| Identity | derived from the token server-side — the app never sends `customerId` |

**Checkout in backend mode** shows the **server-aligned total** and hides coupon/points/
wallet perks (the server forces `discount=0` this phase), so it never displays a discount it
won't apply. If the session expires mid-checkout you'll see
"انتهت الجلسة، يرجى تسجيل الدخول مرة أخرى لإكمال الطلب", the cart is kept, and you're sent to
login to retry. Network failures show a friendly retry message; the cart is never lost.

## Switching back to mock
Set `EXPO_PUBLIC_USE_BACKEND=false` (or remove it) and restart `expo start`. Everything
returns to mock data instantly.

## Troubleshooting
- **"تعذّر الاتصال بالخادم" / menu error:** backend not running, wrong IP, or phone on a
  different Wi-Fi. Re-check steps 1–3. Test the URL in the phone's browser:
  `http://192.168.1.8:4000/health`.
- **Changed `.env` but nothing changed:** restart `expo start` (env is read at build time).
- **Windows firewall** may block port 4000 the first time — allow access when prompted.
