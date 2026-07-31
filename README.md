# Sun Ray · سن راي ☀

تطبيق موبايل لمقهى **Sun Ray** في الطائف (عربي RTL) مبني بـ Expo + React Native + TypeScript،
مع Backend حقيقي (Express + Prisma + PostgreSQL) مستضاف داخل السعودية.

> **الحالة الحالية:** التطبيق متصل بـ Backend حيّ على HTTPS.
> الـ OTP والدفع ما زالا **تجريبيين** — راجع «المخاطر المعروفة» بالأسفل قبل أي إطلاق حقيقي.

---

## التشغيل السريع

```bash
npm install        # (.npmrc يفعّل legacy-peer-deps تلقائيًا)
npm start          # أو: npx expo start -c   (-c يمسح الكاش بعد تغيير .env)
```

ثم افتح على **Expo Go** (امسح الـ QR)، أو محاكي: `i` (iOS) / `a` (Android).

```bash
npm run typecheck        # tsc --noEmit
npx expo export -p ios   # تجربة حزم الـ bundle
```

للعمل ببيانات تجريبية بدون Backend: اضبط `EXPO_PUBLIC_USE_BACKEND=false` في `.env`.

---

# Knowledge base — read this first

Everything below is the operational state of the project. It is written in English to
match the rest of the technical docs (`backend/DEPLOYMENT.md`, `backend/deploy/SAUDI_VPS.md`,
`docs/*`).

## 1. Architecture

```
Expo app (Arabic, RTL)
      │  HTTPS, JSON, Bearer access token
      ▼
Caddy  (auto-TLS via Let's Encrypt)      ─┐
      ▼                                   │  docker compose, one VPS
Express + Prisma API  (Node 20)           │  in Riyadh, Saudi Arabia
      ▼                                   │
PostgreSQL 16  (not published to host)   ─┘
```

The app talks to **exactly one system: our backend** (`/api/*`). It never calls Foodics,
never holds a Foodics token, and never processes real payments. See
`docs/FOODICS_INTEGRATION_PLAN.md` §3 for why this boundary is non-negotiable.

## 2. Live environment

| | |
|---|---|
| Public URL | `https://sunraycafe.duckdns.org` |
| Host | LightNode VPS, **Riyadh II, Saudi Arabia** |
| Server IP | `130.94.120.78` |
| Spec | 1 vCPU / 2 GB / 50 GB + 3.8 GB swap (testing tier; upgrade before launch) |
| OS | Ubuntu 24.04 LTS |
| Cost | ~$7.71/mo hourly-billed |
| SSH | `ssh -i ~/.ssh/lightnode_rsa root@130.94.120.78` — **key-only, passwords disabled** |
| Stack location | `/root/sunray/backend/deploy` |

**The hostname is temporary.** `sunray.sa` DNS is controlled by a third party who wasn't
reachable, so we used a free DuckDNS name to unblock TLS. To switch to the real domain:
add an `A` record `api` → `130.94.120.78`, then on the server change one line in
`deploy/.env` (`DOMAIN=api.sunray.sa`) and `docker compose ... up -d`. The certificate
re-issues automatically. Also update `eas.json` (both profiles) and `.env`, then rebuild
the APK.

### Day-to-day operations

```bash
cd /root/sunray/backend/deploy

git pull && docker compose -f docker-compose.prod.yml up -d --build   # deploy new code
docker compose -f docker-compose.prod.yml logs -f api                 # logs
docker compose -f docker-compose.prod.yml exec db psql -U sunray -d sunray
docker compose -f docker-compose.prod.yml down                        # keeps volumes
```

⚠️ **Never `down -v`** — that deletes `pgdata` (the database) and `caddy_data` (the TLS
certificates; Let's Encrypt allows only 5 re-issues per domain per week).

⚠️ **Never re-run `npx prisma db seed`** on a database with real data. `seed.ts` calls
`deleteMany` first, so it wipes every real order and customer. It has been run exactly
once, on the empty database.

## 3. Backend

`backend/` — Express + Prisma. SQLite for local dev (`prisma/dev.db`), **PostgreSQL in
production**; `scripts/use-postgres.mjs` flips the datasource at build time so the
committed schema stays SQLite.

Modules: `auth branches cart customers giftCards health loyalty menu notifications orders wallet`.

Conventions that will bite you if you miss them:

- **Money is stored as integer halalas.** 1 SAR = 100 halalas; `1800` = 18.00 SAR. Never floats.
- **Phone format is 9 digits starting with 5** (`501234567`), validated by
  `/^5\d{8}$/` in `auth.schemas.ts`. Not `05...`, not `+966...`.
- Responses are enveloped: `{ok: true, data: …}` or `{ok: false, error: {code, message}}`.
  Error messages are in Arabic.
- SQLite has no enums, so status-like fields are `String` validated by Zod.
- Env is validated by Zod in `src/config/env.ts` — the server refuses to boot on a bad
  config, and refuses the dev JWT secret or any secret under 32 chars in production.

### Auth flow

`POST /api/auth/login` (phone) → `POST /api/auth/verify` (phone + 4-digit code) →
`{accessToken, refreshToken}` → `GET /api/auth/me`. Also `/refresh`, `/logout`.
Access tokens are short-lived JWTs; refresh tokens are opaque and stored **hashed**
(sha256) so a database leak can't mint sessions.

## 4. Deployment files (`backend/deploy/`)

| File | Purpose |
|---|---|
| `SAUDI_VPS.md` | Full step-by-step walkthrough (Oracle Cloud Jeddah as an appendix) |
| `docker-compose.prod.yml` | Caddy + API + Postgres; Postgres deliberately unpublished |
| `Caddyfile` | Reverse proxy, automatic Let's Encrypt |
| `prod.env.example` | Secrets template → copied to `deploy/.env` on the server (gitignored, `chmod 600`) |
| `provision.sh` | One-time server setup: Docker, ufw, unattended-upgrades, fail2ban, key-only SSH |
| `backup.sh` | Nightly `pg_dump` + 14-day rotation (**cron not yet installed**) |

Hard-won lessons already encoded in these scripts — don't undo them:

- `$SUDO env VAR=x cmd`, never `$SUDO VAR=x cmd`. When `$SUDO` is empty (root), bash has
  already decided at parse time that the line has no assignment prefix, so `VAR=x` becomes
  the command name and fails.
- Never infer "secure" from a command producing no output. The SSH check originally used
  `sshd -T 2>/dev/null | grep -q`; when `sshd -T` failed mid-upgrade it printed nothing,
  matched nothing, and reported "key-only login" on a box still accepting root passwords.
- LightNode images disable automatic updates **three** ways: masked timers, masked services
  (symlinked to `/dev/null`), and `APT::Periodic::*` set to `0`. `dpkg-reconfigure` undoes none.
- `.gitattributes` pins LF for `*.sh`/`Caddyfile`/`*.yml`. Windows checkouts otherwise
  produce CRLF scripts that Linux refuses to execute.
- `ufw` does **not** filter Docker-published ports — Docker writes its own iptables rules.
  This is fine here only because Postgres is never published.

## 5. ⚠️ Known risks — read before any real launch

1. **Mock OTP — any 4 digits logs in as any phone number.** This is live on the public
   internet right now. Anyone who learns the URL can authenticate as any customer and read
   their addresses and order history. Wire a real SMS provider (**Unifonic**, **Msegat**,
   Twilio) before a single real customer exists.
2. **Mock payments.** Coffee is a physical good, so Apple's IAP rule doesn't apply — use a
   Saudi gateway (Moyasar, Tap, HyperPay, PayTabs) or default to pay-at-branch.
3. **No account deletion.** Verified absent from `src/`, `app/`, and `backend/src/`. Both
   Apple (Guideline 5.1.1v) and Google Play **require** in-app account deletion when the app
   has accounts. Guaranteed rejection until built.
4. **No privacy policy page.** `LoginScreen.tsx` references one in text with nothing behind
   it. Both stores require a public URL.
5. **Backups are not scheduled**, and when they are, they'd sit on the same box. Get them
   offsite (`rclone`) before there's data worth keeping.
6. **`prisma db push` runs on every container start.** Fine now; move to
   `prisma migrate deploy` as a release step before the data matters.
7. **Single instance, no redundancy.** Rate limiting and the catalog cache are in-memory,
   so scaling past one instance needs Redis first.
8. **PDPL** — hosting in Saudi Arabia is the foundation, not the whole compliance story.

## 6. Foodics integration — not started

`backend/src/modules/` has **no foodics module**. Only type mappings exist in
`loyalty.service.ts` and `orders.service.ts`. The app side is ready:
`src/services/foodics.ts` + `foodics.types.ts` hold the enums, scopes and pure mappers.

Plan of record: `docs/FOODICS_INTEGRATION_PLAN.md`. Key points:

- Backend owns OAuth (`client_id`/`client_secret`, access + refresh tokens).
- **Webhooks require SSL** — so a stable HTTPS hostname is a prerequisite, not a nicety.
- Loyalty is **Path A**: our backend counts cups (Foodics' own loyalty is amount-based and
  cannot count cups); the reward is issued as a Foodics **Coupon**.
- Credentials go in `deploy/.env` on the server only. **Never** in the app — anything named
  `EXPO_PUBLIC_*` ships inside the APK and can be extracted from any user's phone.

## 7. Building the app

```bash
npx eas-cli login        # interactive — a human must run this
npx eas-cli init         # creates the EAS project id in app.json
npx eas-cli build --profile preview --platform android    # installable APK
```

`eas.json` has two profiles, `preview` (internal APK) and `production`, both pinned to the
backend URL. Identifiers: `com.sunray.cafe` on both platforms, version `1.0.0`.

Store accounts needed later: Apple $99/yr (**organization account needs a D-U-N-S number —
start early, it's slow**), Google Play $25 once.

## 8. Environment variables

App (`.env`, safe — no secrets, ships in the bundle):

```
EXPO_PUBLIC_API_BASE_URL=https://sunraycafe.duckdns.org
EXPO_PUBLIC_USE_BACKEND=true          # false → run on mock data
```

Backend production (`backend/deploy/.env` on the server, **never committed**):
`DOMAIN` · `ACME_EMAIL` · `POSTGRES_PASSWORD` · `JWT_ACCESS_SECRET` (≥32 chars) ·
`ACCESS_TTL` · `REFRESH_TTL_DAYS` · `CORS_ORIGINS` (empty for the mobile app — React
Native sends no `Origin` header).

---

## التقنيات
- **Expo Router** (تنقل ملفّي) · **Zustand** (الحالة) · **TypeScript صارم**
- خطوط **Tajawal** + **Plus Jakarta Sans** · أيقونات **Ionicons**
- **RTL** مفعّل + أرقام عربية-هندية · بنية i18n جاهزة للإنجليزية

## البنية
```
app/                    مسارات Expo Router (رفيعة، تعيد تصدير الشاشات)
  (auth)/  splash · onboarding · language · login · otp
  (tabs)/  home · menu · orders · loyalty · account
  product/[id] · cart · checkout · order-success · orders/[id] · track/[id]
  wallet/ · gift/ · offers · reserve · waitlist · addresses · address-new
  edit-profile · settings · support · faq
src/
  components/  مكوّنات قابلة لإعادة الاستخدام (Button, Card, ProductCard, …)
  screens/     منطق كل شاشة
  store/        Zustand (auth, cart, wallet, loyalty, order, gift, branch, …)
  data/         بيانات تجريبية (المنيو، الفروع، الكوبونات، …)
  types/ theme/ hooks/ utils/ i18n/ constants/ services/ assets/
backend/
  src/modules/  auth · branches · cart · customers · giftCards · health ·
                loyalty · menu · notifications · orders · wallet
  prisma/       schema.prisma · seed.ts
  deploy/       docker-compose.prod.yml · Caddyfile · provision.sh · backup.sh
```

## ملاحظات
- لا توجد مفاتيح API داخل التطبيق. الأسرار كلها على السيرفر في `backend/deploy/.env`.
- اضبط قواعد العمل (الضريبة، رسوم التوصيل، عتبات الولاء) من `src/constants/config.ts`.
- وثائق إضافية: `docs/FRONTEND_MVP_STATUS.md` · `docs/SECURITY_HARDENING_NOTES.md` ·
  `docs/FOODICS_INTEGRATION_PLAN.md` · `backend/SECURITY.md`
