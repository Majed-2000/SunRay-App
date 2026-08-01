# Sun Ray · سن راي ☀

تطبيق موبايل لمقهى **Sun Ray** في الطائف (عربي RTL) — Expo + React Native + TypeScript،
مع Backend حقيقي (Express + Prisma + PostgreSQL) مستضاف **داخل السعودية**، ومربوط بنظام
**فودكس** لنقاط البيع.

> **الحالة:** التطبيق يعمل على Backend حيّ، والمنيو من فودكس مباشرة.
> الـ OTP والدفع ما زالا غير مفعّلين — راجع «العوائق» بالأسفل قبل أي إطلاق.

## التشغيل السريع

```bash
npm install        # (.npmrc يفعّل legacy-peer-deps تلقائيًا)
npm start          # أو: npx expo start -c   (-c يمسح الكاش بعد تغيير .env)
npm run typecheck  # tsc --noEmit
```

للعمل ببيانات تجريبية بدون Backend: `EXPO_PUBLIC_USE_BACKEND=false` في `.env`.

---

# Knowledge base — read this first

Operational state of the project. English, to match `backend/DEPLOYMENT.md`,
`backend/deploy/SAUDI_VPS.md` and `docs/*`.

## 1. Architecture

```
Expo app (Arabic, RTL)
      │  HTTPS · JSON · Bearer access token
      ▼
Caddy (auto-TLS)  →  Express + Prisma (Node 20)  →  PostgreSQL 16
                            │
                            │  read-only, server-side only
                            ▼
                     Foodics POS API v5
```

The app talks to **exactly one system: our backend**. It never calls Foodics,
never holds a Foodics token, never processes payments. Anything named
`EXPO_PUBLIC_*` ships inside the APK and can be extracted from any user's phone.

## 2. Live environment

| | |
|---|---|
| Public URL | `https://sunraycafe.duckdns.org` |
| Host | LightNode VPS, **Riyadh II, Saudi Arabia** |
| Server IP | `130.94.120.78` (also the outbound IP) |
| Spec | 1 vCPU / 2 GB / 50 GB + 3.8 GB swap — ~$7.71/mo, hourly billed |
| OS | Ubuntu 24.04 · Docker · ufw · fail2ban · unattended-upgrades |
| SSH | `ssh -i ~/.ssh/lightnode_rsa root@130.94.120.78` — **key-only** |
| Stack | `/root/sunray/backend/deploy` |
| Backups | `/root/backups` — nightly 03:15 via `/etc/cron.d/sunray-backup`, verified running |

**The hostname is temporary.** `sunray.sa` DNS is held by a third party who was
unreachable, so DuckDNS unblocked TLS. To switch: add an `A` record `api` →
`130.94.120.78`, set `DOMAIN=api.sunray.sa` in `deploy/.env`, `up -d`, then
update `eas.json` (both profiles) + root `.env` and rebuild the APK.

```bash
cd /root/sunray/backend/deploy
git pull && docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml logs -f api
```

⚠️ **Never `down -v`** — deletes `pgdata` (the database) and `caddy_data` (TLS
certs; Let's Encrypt allows 5 re-issues per domain per week).

### 🔴 Deploys can fail silently — always verify the image

A deploy once produced a **healthy-looking server running stale code**: `/health`
returned 200, login worked, but the image contained none of the new modules. The
image had been built before `git pull` landed the files.

Checking `/health` is not enough. Verify the code is actually in the image:

```bash
docker compose -f docker-compose.prod.yml exec -T api ls /app/dist/src/modules/<module>/
# still stale? force it:
docker compose -f docker-compose.prod.yml build --no-cache api
```

### 🔴 History: `db push` blocked on unique constraints

The container used to run `prisma db push` on start. Adding a `@unique` column
made it refuse with "possible data loss" and crash-loop the container — twice.
Schema changes then had to be applied by hand with `psql`, which is exactly how
production ended up with no migration history at all.

Fixed by the database rebuild: the container now runs `migrate deploy`, which
applies reviewed migration files and never guesses. **`db push` must never be
pointed at production again.**

## 3. Database

**PostgreSQL everywhere — development, test and production.** SQLite in dev was
the previous setup; Prisma itself calls that an anti-pattern (no enums,
incompatible migration SQL, dialect bugs that only surface in production).
`scripts/use-postgres.mjs`, which flipped the datasource at build time, is gone.

### Three databases, one server

| Database | Purpose | Role |
|---|---|---|
| `sunray` | production | `sunray_app` — DML only |
| `sunray_dev` | development | `sunray_dev` |
| `sunray_test` | automated tests, wiped freely | `sunray_test` |

Postgres listens on **`127.0.0.1:5432` only** — never `0.0.0.0`. It is not
reachable from the internet (verified from outside). Local access goes through
an SSH tunnel:

```bash
npm run db:tunnel     # ssh -N -L 5433:127.0.0.1:5432 root@130.94.120.78
```

⚠️ Writing `5432:5432` in `docker-compose.prod.yml` instead of
`127.0.0.1:5432:5432` **would expose the database publicly** — Docker publishes
ports past `ufw` with its own iptables rules.

### Least privilege

| Role | Can do |
|---|---|
| `sunray_migrator` | `CREATE/ALTER/DROP` — used only at deploy time |
| `sunray_app` | `SELECT/INSERT/UPDATE/DELETE` — **cannot alter the schema** |

A leaked runtime credential can no longer reshape or drop the database.
`sunray_dev` and `sunray_test` additionally hold `CREATEDB`, which Prisma needs
for the shadow database when generating migrations. Production never runs
`migrate dev`, only `migrate deploy`, which needs no shadow.

### Schema conventions

Each prevents a specific class of bug, not a style preference:

- **Money is integer halalas** (1 SAR = 100). Never float, never decimal in app
  code. Convert only at the edges. `CHECK` constraints enforce non-negative.
- **VAT is INCLUSIVE.** `total` is what the customer pays; `vat` is the portion
  inside it. `CHECK (vat <= total)` makes the old overcharging bug impossible.
- **Every `DateTime` is `@db.Timestamptz(6)`.** Prisma's default is
  `timestamp(3)` *without* time zone — it stores a wall-clock reading rather
  than a moment, so two people in different zones read the same row differently.
- **snake_case in the database, camelCase in Prisma** via `@map`/`@@map`. No
  more quoting `"Order"` in hand-written SQL.
- **Every foreign key has an index.** PostgreSQL does not create them; 13 of our
  16 were missing before the rebuild, turning every join and parent delete into
  a sequential scan.
- **Stable value sets are native enums** (`OrderType`, `OrderStatus`,
  `WalletTxType`, `WalletTxSource`, `GiftCardStatus`, `Gender`). Sets we expect
  to churn stay strings with a `CHECK` — enums are cheap to extend, painful to
  shrink.
- **Soft delete via `deletedAt`** on `Product` and `Category`: a menu item
  withdrawn from Foodics is hidden, not removed, so past orders stay intact.
- **`OrderItem` and `OrderItemOption` snapshot** the name and price at order
  time and hold no FK to `ModifierOption`. Menu sync rebuilds those rows
  wholesale; an invoice must survive it.

### 18 CHECK constraints — tested, not assumed

Prisma cannot express these, so they are appended by hand to the init migration.
Zod validates every request, so they should never fire from normal traffic; they
exist for everything Zod does not see — a `psql` session, a repair script, a
future service, a bug. Verified to actually reject:

```
negative price · phone "0501234567" · birth month 13 · unknown notification kind
min_selected > max_selected · order status outside the enum
```

…while still accepting a valid phone **and** the `deleted:<hash>` tombstone that
account deletion writes. That last case matters: a stricter phone rule would
have silently broken account deletion.

### Migrations

One clean `init` migration, generated against PostgreSQL. The previous history
was written for SQLite and the production database had been changed by hand with
`psql`, so `migrate deploy` had nothing to reconcile against.

```bash
npx prisma migrate dev        # dev: generate + apply
npx prisma migrate deploy     # prod: apply only
npx prisma migrate status     # confirm — never declare success without it
npm run db:check              # migrate diff: fails on any schema/database drift
```

⚠️ **Never `prisma db push` against production.** It refuses to add a unique
constraint ("possible data loss") and leaves the container crash-looping — this
happened, twice.

## 4. Backend conventions

`backend/src/modules/`: `auth branches cart customers foodics giftCards health
loyalty menu notifications orders wallet`.

- **Phone is 9 digits starting with 5** (`501234567`) — `/^5\d{8}$/` in
  `auth.schemas.ts`. Not `05…`, not `+966…`. Foodics stores the same shape, and
  the database enforces it too.
- Responses: `{ok: true, data}` / `{ok: false, error: {code, message}}`, errors in Arabic.
- Env is Zod-validated in `config/env.ts`; the server refuses to boot on a bad
  config, on the dev JWT secret, or on a secret under 32 chars.
- Identity always comes from `req.auth.customerId` (the session token), **never**
  from a parameter. That is what keeps every list scoped to its owner.

## 5. Foodics integration

**Business:** `sunray` · reference **850056** · plan `new advanced` ·
owner Mohammed Alshahrani (`sunray.sa811@gmail.com`) · token type
`Foodics Personal`, **never expires**.

Everything we do is **read-only** (`GET`). Nothing has ever been created or
modified in Foodics.

### Granted scopes

```
general.read · orders.list · orders.limited.read · orders.limited.create
orders.limited.pay · orders.limited.decline · customers.list · customers.write
menu.write · orders.gift_cards.read/write · customers.accounts.read/write
customers.loyalty.read · coupons.read · operations.read
```

**`coupons.write` is NOT granted** — `POST /coupons` returns **403**. This blocks
the loyalty reward ("buy 6, get the 7th free"), which issues a Foodics coupon.
Must be requested from Foodics support (ticket **#2952033**).

### API quirks — verified, and several contradict the official docs

| Behaviour | Docs say | Reality |
|---|---|---|
| `/orders` pagination | normal `page` | **stops silently after 10 pages (500 orders)** → use `filter[reference_after]` cursor |
| `include=products` | enough | **no `product_id` at all** → must use `products.product` |
| Filter products by branch | assumed | `filter[branches.id]` → **400** → filter locally with `include=branches` |
| Soft-deleted products | — | **appear in the normal list** → exclude by hand (68 of 237 here) |
| `include=modifiers` | optional | **mandatory**, else every product reports zero modifiers |
| Modifier options | — | absent from the product include AND from `GET /modifiers?include=options`; only the **single** `GET /modifiers/{id}` returns them |
| Payment types | External (8) only | **type 7 works** (proven with a real paid order) |
| `Bearer` | — | **case-sensitive**; lowercase fails auth |
| `per_page` | — | capped at **50** everywhere |

Other load-bearing details:

- `branches[].pivot.price` overrides the top-level price when not null.
- `pivot.excluded_options_ids` hides options for one product specifically.
- `name_localized` is the Arabic name; `name` is English.
- Net quantity = `quantity − returned_quantity`.
- Order tag already in the account: «طلبات التطبيق»
  `a23da217-c043-4081-a707-05d482d0ebdc`.
- Tax: one group, **15%**, assumed **inclusive** (`tax = total − total/1.15`) —
  Foodics exposes no `is_inclusive` flag. Confirm from a printed receipt.
- **Rate limiting is real:** a bulk `/orders` scan once exhausted the quota and
  delayed a live customer order by 13s. Never run a heavy scan while serving.
- **Never blindly retry `POST /orders`** — search by `meta.3rd_party_order_number`
  first, or the customer gets charged twice at the counter.

### Branches

| Branch | Foodics id | Status |
|---|---|---|
| **الحلقة الغربية** | `9b579fa8-23b2-4f68-8dbc-dfc02bd889a0` | the only active branch |
| البلد | `9e686db5-…` | **seasonal, closed** — sync deactivates it |

**Coordinates: `21.3426559, 40.4401445`** — known, but **not set in Foodics**.
Sync no longer writes Foodics' nulls over local values (absence of data is not
data), but that only fixes the app's map. Order injection reads the branch from
**Foodics**, so until the console has the coordinates `POST /orders` returns
`2xx` and **the order never reaches the cashier** — a silent failure. This is why
`FOODICS_ORDER_INJECTION=false`.

### Menu sync

`backend/src/modules/foodics/` — `foodics.client.ts`, `foodics.sync.ts`,
`foodics.history.ts`, `foodics.routes.ts`.

```bash
docker compose -f docker-compose.prod.yml exec -T api node -e "
require('/app/dist/src/modules/foodics/foodics.sync.js').syncFoodicsMenu()
  .then(r=>console.log(JSON.stringify(r,null,2)))"
```

Current result (~3s): **111 products** · 18 categories · 31 modifier groups ·
64 options · 1 branch. Of 237 products seen: 68 soft-deleted, 57 inactive, 1 not
in branch. Modifier definitions are memoised per run (5 fetches, not 31).

`/api/foodics/*` exists but returns **404 in production** — `docker-compose.prod.yml`
pins `ADMIN_ENABLED: 'false'` in `environment:`, which **overrides `env_file`**.
That is deliberate: exposing admin routes publicly on a server with mock OTP is a
bad trade. Run sync via `docker compose exec` instead.

### Past order history

`GET /api/orders/history` returns what a customer bought at the counter before
the app. Both filters verified: `filter[phone]` matches exactly,
`filter[customer_id]` returns their orders in one call.

🔴 **Gated in code on `OTP_PROVIDER !== 'mock'`.** The business has **~4,058 real
customers**. While any 4 digits authenticate any phone, anyone could type a
customer's number and read their name, full purchase history and spending. For
Saudi residents' personal data that is a PDPL exposure. The gate lifts by itself
when a real provider is configured.

## 6. SMS / OTP — Yamamah (اليمامة)

Real OTP is **built and deployed** but inactive.

```
POST https://api.yamamah.com/SendSMS
{ Username, Password, Tagname, RecepientNumber, VariableList,
  ReplacementList, Message, SendDateTime, EnableDR }
```

### 🔴 Blocked on one thing: IP whitelist

Yamamah authorises by source IP. Ours is **`130.94.120.78`** (verified from the
server). Until it is whitelisted, every call times out — `api.yamamah.com`
resolves to `95.129.8.184` but never answers. **A timeout means "not
whitelisted", not "bad credentials"**; `getCredit()` distinguishes the two
without spending an SMS.

A relay at `cloud.shubra.net/sms/send-sms` was used to dodge the whitelist; it
now returns 503 while the host itself serves 200. Abandoned — calling Yamamah
directly also removes a third party from the path OTP codes travel.

- `RecepientNumber` is **misspelled by Yamamah**; correcting it breaks delivery.
- `ReplacementList` is in the spec but was missing from the relay example.
- Their doc says `http://`; we default to `https` so credentials are not sent in
  clear text.

### OTP hardening (`OtpChallenge` table)

random `randomInt` code · **only sha256 stored** · 5-minute expiry · single-use ·
5 attempts then burned · a new request invalidates the previous code · one
identical rejection message for wrong/expired/exhausted/absent · **a failed send
burns the challenge immediately** (a code nobody received must not stay
guessable — the 503 above exercised exactly this path).

### To activate

```
OTP_PROVIDER=yamamah      # in deploy/.env, then up -d
```

That single line also lifts the order-history gate. No code change.

## 7. The app

### Build

```bash
npx expo run:android --variant release   # builds + installs over USB
# APK: android/app/build/outputs/apk/release/app-release.apk
```

`android/` is gitignored and regenerated by `expo prebuild` — **never edit
`android/gradle.properties` by hand**, the change disappears. Use a config
plugin (see `plugins/withAndroidAbiFilters.js`).

Needs `JAVA_HOME="C:\Program Files\Android\Android Studio\jbr"` and
`ANDROID_HOME="$LOCALAPPDATA\Android\Sdk"`. No Expo login required.

### Size: 79.6 MB → 38.1 MB

Native libraries were 60 MB of 71.6, and **33 MB were `x86`/`x86_64` —
emulator-only, dead weight on every phone**. Proguard + resource shrinking alone
recovered just 8 MB because they do not touch native libs.
`plugins/withAndroidAbiFilters.js` limits the build to `arm64-v8a` +
`armeabi-v7a`. Trade-off: no Intel/AMD emulator; add them back in that file.
For Play Store prefer an **AAB** — Google splits per device automatically.

### Android lessons (none of these appear in Expo Go)

Expo Go supplies its own splash screen and window handling, so the first real
native build is when they surface.

- **Splash:** `app.json` had a splash `backgroundColor`/`resizeMode` with **no
  image**, so the plugin emitted a `values.xml` referencing a drawable it never
  generated → release build failed at resource linking. Would have broken any EAS
  production build too.
- **`edgeToEdgeEnabled`** must be set. From Android 15 apps draw behind the
  system bars; without it content sits under the navigation bar.
- **Keyboard:** from Android 15 the system **stops resizing the window** for
  `adjustResize` when drawing edge-to-edge. `KeyboardAvoidingView` is required —
  it now wraps `ScreenContainer` (so OTP and gift-card screens benefit) and
  `LoginScreen`, which was a centred layout with no scroll, so nothing could move.

### Performance

The menu froze on "الكل" because it was a `ScrollView` mapping over every
product — all 111 rows mounted before first paint. Now a `FlatList`:

- **`getItemLayout`** — rows are a fixed 90px (`PRODUCT_ROW_HEIGHT`, exported
  rather than hardcoded), so offsets are arithmetic and nothing is measured.
  Biggest win by far.
- `ProductRow` is `memo`ised; this screen subscribes to the cart store, so every
  cart change used to re-render every mounted row.
- Filtered list / `renderItem` / `keyExtractor` memoised.
- `initialNumToRender: 8` · `windowSize: 7` · `removeClippedSubviews`.

Tablets keep the grid: fewer, larger cards, no freeze reported.

### Orders screen

Two tabs — **نشط / منتهي** — with counts inside the tab, matching the existing
pickup/delivery toggle (`SegmentedTabs`). "منتهي" merges app orders and Foodics
counter history into one stream, newest first: splitting by origin would push our
data model onto the customer. Foodics rows show **«تم التسليم»** and are
deliberately not pressable — no detail screen exists behind them. History failing
is silent; no history is the normal case.

## 8. 🔴 Blockers

**Needs the owner (outside what the code can do):**

1. **Whitelist `130.94.120.78` at Yamamah** → unlocks real OTP **and** order history.
2. **Set branch coordinates in the Foodics console** (`21.3426559, 40.4401445`)
   → unlocks order injection. Also confirm a device is set to receive online orders.
3. **Request `coupons.write`** (ticket #2952033) → unlocks loyalty rewards.
4. **Rotate the Yamamah password** — it was shared in a chat transcript.
5. **DNS for `api.sunray.sa`** — held by a third party.

**Before real customers:**

6. **No account deletion** — verified absent. Apple 5.1.1(v) and Google Play both
   require it in-app; Google also wants a web URL. **Guaranteed rejection.**
7. **No privacy policy page** — `LoginScreen.tsx` references one in text with
   nothing behind it. Both stores require a public URL.
8. **Mock payments** — coffee is a physical good, so Apple's IAP cut does not
   apply; use Moyasar / Tap / HyperPay / PayTabs, or ship pay-at-branch.
9. **Apple review needs a demo account** — reviewers abroad cannot receive a
   Saudi SMS. Provide a fixed bypass code in the review notes.
10. **Backups sit on the same box.** Scheduled nightly and verified, but a lost
    server takes them with it — get them offsite with `rclone`.
11. **Single instance**; rate limiting and the catalog cache are in-memory, so
    scaling past one needs Redis.
12. **PDPL** — hosting in Saudi Arabia is the foundation, not the whole story.

Resolved since the last revision: account deletion is built; privacy and terms
pages are served; VAT is inclusive so the app no longer overcharges; migrations
replaced `db push`; foreign keys are indexed; backups are scheduled.

Store accounts: Apple $99/yr (**organisation needs a D-U-N-S number — slow,
start early**), Google Play $25 once. Identifiers: `com.sunray.cafe`, v1.0.0.

## 9. Environment variables

App (`.env` — ships in the bundle, no secrets):

```
EXPO_PUBLIC_API_BASE_URL=https://sunraycafe.duckdns.org
EXPO_PUBLIC_USE_BACKEND=true
```

Backend (`backend/deploy/.env` on the server, `chmod 600`, **never committed**):
`DOMAIN` · `ACME_EMAIL` · `POSTGRES_PASSWORD` · `JWT_ACCESS_SECRET` (≥32) ·
`ACCESS_TTL` · `REFRESH_TTL_DAYS` · `CORS_ORIGINS` (empty for mobile) ·
`FOODICS_TOKEN` · `FOODICS_BASE_URL` · `FOODICS_BRANCH_ID` ·
`FOODICS_ORDER_INJECTION` · `OTP_PROVIDER` · `SMS_URL` · `SMS_USERNAME` ·
`SMS_PASSWORD` · `SMS_SENDER` · `OTP_TTL_SECONDS` · `OTP_MAX_ATTEMPTS`

---

## التقنيات
- **Expo Router** · **Zustand** · **TypeScript صارم**
- خطوط **Tajawal** + **Plus Jakarta Sans** · أيقونات **Ionicons**
- **RTL** مفعّل + أرقام عربية-هندية

## البنية
```
app/                 مسارات Expo Router
src/
  components/  screens/  store/  services/  theme/  hooks/  i18n/  utils/
plugins/             إضافات Expo (تقييد معماريات أندرويد)
backend/
  src/modules/  auth · branches · cart · customers · foodics · giftCards ·
                health · loyalty · menu · notifications · orders · wallet
  prisma/       schema.prisma · migrations/ · seed.ts
  deploy/       docker-compose.prod.yml · Caddyfile · provision.sh · backup.sh
```

## ملاحظات
- لا مفاتيح API داخل التطبيق. الأسرار كلها على السيرفر في `backend/deploy/.env`.
- قواعد العمل (الضريبة، رسوم التوصيل، عتبات الولاء) في `src/constants/config.ts`.
- وثائق إضافية: `backend/deploy/SAUDI_VPS.md` · `docs/FOODICS_INTEGRATION_PLAN.md` ·
  `docs/SECURITY_HARDENING_NOTES.md` · `backend/SECURITY.md`
