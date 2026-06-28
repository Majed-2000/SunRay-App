# Sun Ray Backend (beginner-friendly)

A small **Node.js + TypeScript + Express + Prisma + SQLite** backend for the Sun Ray
cafe app. It is **mock-only** for now: no Foodics, no real payments, no real SMS/OTP.

---

## 1. What is a "backend"?

The **frontend** is the mobile app you can see and tap. The **backend** is a separate
program that runs on a server (here: your computer) and does the work the app can't or
shouldn't do by itself: store data permanently, do calculations you can trust, and keep
secrets safe.

The app currently fakes ("mocks") its data. This backend is the real thing the app will
talk to later.

## 2. Why does the mobile app need a backend?

- **A shared source of truth.** Orders, wallet balances, loyalty counts must be the same
  for everyone and survive app restarts. A database on the server does that.
- **Trust.** Prices, totals, payments, and rewards must be decided by the server. A phone
  can be tampered with; the server can't be (as easily).
- **Secrets.** Things like the future Foodics token or payment keys must NEVER be inside
  the app (anyone can unpack an app). They live only on the backend.

So the app talks to **our backend**, and only the backend talks to Foodics/payments later.

## 3. The tools (in one line each)

- **Express** — listens for requests (like "GET the menu") and sends back answers.
- **Prisma** — a friendly translator between our code and the database (we write
  `prisma.product.findMany()` instead of raw SQL).
- **SQLite** — the database, stored as a single file (`prisma/dev.db`). Nothing to install.
- **Zod** — checks incoming data is valid before we trust it.
- **dotenv** — loads settings from a `.env` file.
- **TypeScript** — JavaScript with type-checking, so we catch mistakes early.

---

## 4. Install dependencies

```bash
cd backend
npm install
```

## 5. Create the database (tables)

```bash
cp .env.example .env            # one-time: create your local settings
npx prisma migrate dev --name init
```
This reads `prisma/schema.prisma`, creates `prisma/dev.db`, and builds all the tables.

## 6. Seed test data

```bash
npm run db:seed
```
Inserts 2 branches, menu categories + products (with modifiers), one test customer
(**phone `501234567`**), wallet transactions, a loyalty counter, and sample notifications.

## 7. Run the backend

```bash
npm run dev
```
You should see: `Sun Ray backend running at http://localhost:4000`.
Leave it running; it auto-restarts when you change a file.

Other useful commands:
```bash
npm run typecheck     # check types (tsc --noEmit)
npm run prisma:studio # open a visual DB browser in your web browser
npm run db:reset      # wipe + recreate + reseed the database
```

---

## 8. Test the endpoints (curl examples)

> Tip: many endpoints need a customer id. Get one from `verify` first.

```bash
# Health
curl http://localhost:4000/health

# Branches & menu
curl http://localhost:4000/api/branches
curl http://localhost:4000/api/menu

# Auth (mock): login then verify with ANY 4-digit code
curl -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" -d '{"phone":"501234567"}'

curl -X POST http://localhost:4000/api/auth/verify \
  -H "Content-Type: application/json" -d '{"phone":"501234567","code":"1234"}'
# → copy the "id" from data.customer

# Replace CID below with that id:
CID=PASTE_CUSTOMER_ID

# Wallet
curl http://localhost:4000/api/customers/$CID/wallet
curl -X POST http://localhost:4000/api/customers/$CID/wallet/top-up \
  -H "Content-Type: application/json" -d '{"amount":5000}'   # 5000 halalas = 50.00 SAR

# Loyalty
curl http://localhost:4000/api/customers/$CID/loyalty

# Create an order (get a productId from /api/menu first)
curl -X POST http://localhost:4000/api/orders \
  -H "Content-Type: application/json" \
  -d "{\"customerId\":\"$CID\",\"type\":\"PICKUP\",\"items\":[{\"productId\":\"PASTE_PRODUCT_ID\",\"quantity\":2,\"modifierOptionIds\":[]}]}"

# Gift card: issue then redeem (redeem credits the recipient wallet)
curl -X POST http://localhost:4000/api/gift-cards \
  -H "Content-Type: application/json" \
  -d "{\"senderCustomerId\":\"$CID\",\"recipientPhone\":\"501112222\",\"amount\":10000}"

curl -X POST http://localhost:4000/api/gift-cards/redeem \
  -H "Content-Type: application/json" -d "{\"code\":\"PASTE_CODE\",\"customerId\":\"$CID\"}"

# Notifications
curl http://localhost:4000/api/customers/$CID/notifications
curl -X PATCH http://localhost:4000/api/customers/$CID/notifications/read-all
```

**Money note:** all amounts are integer **halalas** (1 SAR = 100 halalas). `1800` = 18.00 ﷼.

**Response shape:** success is `{ "ok": true, "data": ... }`, errors are
`{ "ok": false, "error": { "code", "message", "details"? } }`.

---

## 9. Endpoints summary

| Method | Path | Purpose |
|---|---|---|
| GET | `/health` | server alive check |
| POST | `/api/auth/login` | mock OTP session |
| POST | `/api/auth/verify` | verify (any 4 digits) → customer + fake token |
| GET | `/api/customers/:id` | get profile |
| PATCH | `/api/customers/:id` | update name/email/gender/city/birthDay/birthMonth |
| GET/POST | `/api/customers/:id/addresses` | list / add address |
| GET | `/api/branches` | active branches |
| GET | `/api/menu` | categories + products (with modifiers) |
| GET | `/api/products/:id` | one product |
| POST | `/api/orders` | create order (prices computed server-side) |
| GET | `/api/orders` (`?customerId=`) | list orders |
| GET | `/api/orders/:id` | one order |
| PATCH | `/api/orders/:id/status` | change status |
| GET | `/api/customers/:id/wallet` | balance + transactions |
| POST | `/api/customers/:id/wallet/top-up` | add balance (mock) |
| GET | `/api/customers/:id/gift-cards` | the customer's cards |
| POST | `/api/gift-cards` | issue a gift card |
| POST | `/api/gift-cards/redeem` | redeem → credit recipient wallet |
| GET | `/api/customers/:id/loyalty` | cup counter |
| POST | `/api/customers/:id/loyalty/redeem` | redeem a free-coffee reward |
| GET | `/api/customers/:id/notifications` | list |
| PATCH | `/api/customers/:id/notifications/read-all` | mark all read |

---

## 10. How the Expo app will connect later

The app already has service files (`src/services/*`) and an HTTP helper (`src/services/api.ts`)
that point at these endpoints. To switch the app from mock to backend (in a LATER phase):

1. In the app root, copy `.env.example` to `.env`.
2. Set `EXPO_PUBLIC_API_BASE_URL` to a URL the phone can reach:
   - **Real phone (Expo Go):** use your PC's LAN IP, e.g. `http://192.168.1.8:4000`
     (NOT `localhost` — on the phone that means the phone itself).
   - Or use a tunnel.
3. Set `EXPO_PUBLIC_USE_BACKEND=true`.
4. Wire the screens/stores to call the services instead of the mock data (one screen at a time).

Until then, the app keeps working fully on mock data and never calls this backend.

## 11. Moving to PostgreSQL later

SQLite is great for learning. To switch to PostgreSQL: in `prisma/schema.prisma` change
`provider = "sqlite"` to `"postgresql"`, set a `postgresql://` `DATABASE_URL` in `.env`,
then run `npx prisma migrate dev`. (We can also upgrade the text status fields to real
database enums at that point.)

## 12. Next phase

Real OTP/SMS, real payments via a gateway, the Foodics integration (menu sync, order
injection, webhooks) — all on the backend — then connect the app screen by screen.
