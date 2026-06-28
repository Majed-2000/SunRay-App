/**
 * Seed script — fills the database with realistic starting data so we can test
 * the API immediately. Run it with:  npm run db:seed
 *
 * It is idempotent: it deletes everything first, then re-inserts. Safe to run again.
 * Money is in halalas (1 SAR = 100 halalas); `sar(18)` => 1800.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const sar = (n: number) => Math.round(n * 100);

async function main() {
  // 1) Clear existing rows (children first to respect relations) ----------------
  await prisma.notification.deleteMany();
  await prisma.loyaltyReward.deleteMany();
  await prisma.loyaltyCounter.deleteMany();
  await prisma.walletTransaction.deleteMany();
  await prisma.giftCard.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.modifierOption.deleteMany();
  await prisma.modifier.deleteMany();
  await prisma.product.deleteMany();
  await prisma.category.deleteMany();
  await prisma.address.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.branch.deleteMany();

  // 2) Branches -----------------------------------------------------------------
  await prisma.branch.createMany({
    data: [
      {
        name: 'سن راي · الحلقة الغربية',
        address: 'شارع الحلقة الغربية، الطائف',
        latitude: 21.2703,
        longitude: 40.4158,
        openingFrom: '06:00',
        openingTo: '00:00',
        isActive: true,
      },
      {
        name: 'سن راي · الفيصلية',
        address: 'شارع الفيصلية، الطائف',
        latitude: 21.2854,
        longitude: 40.4356,
        openingFrom: '07:00',
        openingTo: '23:00',
        isActive: true,
      },
    ],
  });

  // 3) Categories (keep ids so products can reference them) ---------------------
  const categorySeed = [
    { key: 'hot', nameAr: 'قهوة ساخنة', nameEn: 'Hot Coffee', sortOrder: 1 },
    { key: 'cold', nameAr: 'قهوة باردة', nameEn: 'Cold Coffee', sortOrder: 2 },
    { key: 'v60', nameAr: 'في٦٠', nameEn: 'V60', sortOrder: 3 },
    { key: 'matcha', nameAr: 'ماتشا', nameEn: 'Matcha', sortOrder: 4 },
    { key: 'bakery', nameAr: 'مخبوزات', nameEn: 'Bakery', sortOrder: 5 },
    { key: 'dessert', nameAr: 'حلا', nameEn: 'Desserts', sortOrder: 6 },
  ];
  const catId: Record<string, string> = {};
  for (const c of categorySeed) {
    const created = await prisma.category.create({
      data: { nameAr: c.nameAr, nameEn: c.nameEn, sortOrder: c.sortOrder, isActive: true },
    });
    catId[c.key] = created.id;
  }

  // 4) Products. Coffee drinks get Size + Milk modifiers via nested create ------
  const sizeModifier = {
    nameAr: 'الحجم',
    nameEn: 'Size',
    minSelected: 1,
    maxSelected: 1,
    isRequired: true,
    options: {
      create: [
        { nameAr: 'صغير', nameEn: 'Small', price: sar(-2) },
        { nameAr: 'وسط', nameEn: 'Medium', price: 0 },
        { nameAr: 'كبير', nameEn: 'Large', price: sar(3) },
      ],
    },
  };
  const milkModifier = {
    nameAr: 'الحليب',
    nameEn: 'Milk',
    minSelected: 0,
    maxSelected: 1,
    isRequired: false,
    options: {
      create: [
        { nameAr: 'عادي', nameEn: 'Regular', price: 0 },
        { nameAr: 'حليب لوز', nameEn: 'Almond', price: sar(3) },
        { nameAr: 'حليب شوفان', nameEn: 'Oat', price: sar(3) },
      ],
    },
  };

  // Coffee products with modifiers
  const coffeeProducts = [
    { nameAr: 'كابتشينو', nameEn: 'Cappuccino', cat: 'hot', price: 18, featured: true, cal: 120 },
    { nameAr: 'فلات وايت', nameEn: 'Flat White', cat: 'hot', price: 20, cal: 150 },
    { nameAr: 'لاتيه', nameEn: 'Latte', cat: 'hot', price: 19, cal: 190 },
    { nameAr: 'سبانش لاتيه', nameEn: 'Spanish Latte', cat: 'hot', price: 21, featured: true, cal: 220 },
    { nameAr: 'آيس لاتيه', nameEn: 'Iced Latte', cat: 'cold', price: 20, cal: 160 },
    { nameAr: 'آيس سبانش', nameEn: 'Iced Spanish', cat: 'cold', price: 23, featured: true, cal: 240 },
    { nameAr: 'ماتشا لاتيه', nameEn: 'Matcha Latte', cat: 'matcha', price: 24, cal: 180 },
  ];
  for (const p of coffeeProducts) {
    await prisma.product.create({
      data: {
        categoryId: catId[p.cat],
        nameAr: p.nameAr,
        nameEn: p.nameEn,
        descriptionAr: 'قهوة مختصّة محضّرة بعناية',
        price: sar(p.price),
        calories: p.cal,
        isAvailable: true,
        isFeatured: Boolean(p.featured),
        preparationTime: 4,
        modifiers: { create: [sizeModifier, milkModifier] },
      },
    });
  }

  // Simple products without modifiers
  await prisma.product.createMany({
    data: [
      { categoryId: catId['v60'], nameAr: 'في٦٠ كولومبي', nameEn: 'V60 Colombia', price: sar(26), calories: 5, isFeatured: true, preparationTime: 8 },
      { categoryId: catId['v60'], nameAr: 'في٦٠ إثيوبي', nameEn: 'V60 Ethiopia', price: sar(25), calories: 5, preparationTime: 8 },
      { categoryId: catId['bakery'], nameAr: 'كرواسون لوز', nameEn: 'Almond Croissant', price: sar(16), calories: 320, preparationTime: 2 },
      { categoryId: catId['dessert'], nameAr: 'تشيز كيك', nameEn: 'Cheesecake', price: sar(24), calories: 450, preparationTime: 2 },
      { categoryId: catId['dessert'], nameAr: 'براوني', nameEn: 'Fudge Brownie', price: sar(17), calories: 410, preparationTime: 2 },
    ],
  });

  // 5) Test customer (phone matches the app's mock user) ------------------------
  const customer = await prisma.customer.create({
    data: {
      name: 'نوف',
      phone: '501234567',
      email: 'nouf@example.com',
      gender: 'female',
      city: 'الطائف',
      addresses: {
        create: [
          { label: 'home', city: 'الطائف', district: 'الفيصلية', street: 'شارع ٢٠', details: 'المنزل' },
        ],
      },
      loyaltyCounter: { create: { cupCount: 4, goal: 6 } },
    },
  });

  // 6) Wallet transactions → ending balance 75 SAR ------------------------------
  await prisma.walletTransaction.create({
    data: { customerId: customer.id, type: 'CREDIT', source: 'TOP_UP', amount: sar(100), balanceAfter: sar(100), note: 'شحن المحفظة' },
  });
  await prisma.walletTransaction.create({
    data: { customerId: customer.id, type: 'DEBIT', source: 'ORDER_PAYMENT', amount: sar(25), balanceAfter: sar(75), note: 'دفع طلب' },
  });

  // 7) Sample notifications -----------------------------------------------------
  await prisma.notification.createMany({
    data: [
      { customerId: customer.id, type: 'orderReady', title: 'طلبك جاهز ☕', body: 'طلبك جاهز للاستلام من فرع الحلقة الغربية.', isRead: false },
      { customerId: customer.id, type: 'orderAccepted', title: 'قبل الفرع طلبك ✓', body: 'بدأنا تحضير طلبك، نراك قريبًا!', isRead: false },
      { customerId: customer.id, type: 'pointsEarned', title: 'ربحت نقاطًا ⭐', body: 'أُضيفت نقاط إلى رصيدك من طلبك الأخير.', isRead: true },
      { customerId: customer.id, type: 'birthdayOffer', title: 'عرض عيد ميلادك قادم 🎂', body: 'أضف يوم وشهر ميلادك ليصلك عرض مميز.', isRead: true },
    ],
  });

  // Summary
  const counts = {
    branches: await prisma.branch.count(),
    categories: await prisma.category.count(),
    products: await prisma.product.count(),
    customers: await prisma.customer.count(),
    notifications: await prisma.notification.count(),
  };
  console.log('✅ Seed complete:', counts);
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
