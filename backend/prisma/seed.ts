/**
 * Database seed.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * IDEMPOTENT. Safe to run any number of times, in any environment.
 *
 * The previous version opened with `deleteMany()` across every table and called
 * that "idempotent". It was a loaded gun: one accidental `prisma db seed`
 * against production would have erased every real order and customer. Every
 * document in this repo carried a warning about it — and a seed that needs a
 * warning is the wrong shape.
 *
 * It now upserts on a stable key, so a second run changes nothing.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Two tiers, deliberately separated:
 *
 *   REFERENCE — safe everywhere, including production. Currently empty: the
 *   menu belongs to Foodics and arrives via `POST /api/foodics/sync`, so
 *   seeding categories or products here would fight the real source.
 *
 *   DEVELOPMENT — a demo customer and a little wallet history, so a fresh dev
 *   database is usable without placing an order by hand. Refuses to run in
 *   production.
 */
import { PrismaClient, WalletTxSource, WalletTxType } from '@prisma/client';

const prisma = new PrismaClient();

/** Reference data. Runs in every environment. */
async function seedReference(): Promise<void> {
  // Nothing yet — the catalogue is Foodics' to own. Branches, categories,
  // products and modifiers all arrive through menu sync. If a future record is
  // genuinely ours (a notification template, a fee table), it belongs here,
  // upserted on a stable key.
}

/** Development-only fixtures. Never runs in production. */
async function seedDevelopment(): Promise<void> {
  const DEMO_PHONE = '500000001';

  const demo = await prisma.customer.upsert({
    where: { phone: DEMO_PHONE },
    update: {}, // already present? leave it exactly as it is
    create: {
      phone: DEMO_PHONE,
      name: 'عميل تجريبي',
      city: 'الطائف',
    },
  });

  // The wallet is a ledger: the balance is the newest row's `balanceAfter`,
  // never a mutable column. Seeding it twice would invent money, so it is
  // written only when the ledger is empty.
  const existingTx = await prisma.walletTransaction.count({ where: { customerId: demo.id } });
  if (existingTx === 0) {
    await prisma.walletTransaction.create({
      data: {
        customerId: demo.id,
        type: WalletTxType.CREDIT,
        source: WalletTxSource.TOP_UP,
        amount: 10_000, // 100.00 SAR in halalas
        balanceAfter: 10_000,
        note: 'رصيد تجريبي',
      },
    });
  }

  await prisma.loyaltyCounter.upsert({
    where: { customerId: demo.id },
    update: {},
    create: { customerId: demo.id, cupCount: 3, goal: 6 },
  });

  console.log(`  ✓ demo customer ${DEMO_PHONE}`);
}

async function main(): Promise<void> {
  const env = process.env.NODE_ENV ?? 'development';
  console.log(`Seeding (${env})…`);

  await seedReference();

  if (env === 'production') {
    console.log('  ↳ production: reference data only, no demo fixtures');
  } else {
    await seedDevelopment();
  }

  console.log('Done. Run it again — nothing changes.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
