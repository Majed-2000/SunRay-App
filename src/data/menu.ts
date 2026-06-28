import type { Product, ProductSize, ProductAddOn } from '@/types';
import { foodicsId } from '@/utils/ids';

// Shared option sets (each maps to a Foodics modifier option) ----------------
const withFid = <T extends { id: string }>(items: T[], scope: string): (T & { foodicsId: string })[] =>
  items.map((it) => ({ ...it, foodicsId: foodicsId(`modifier:${scope}:${it.id}`) }));

const SIZES: ProductSize[] = withFid(
  [
    { id: 'S', labelAr: 'صغير', labelEn: 'Small', priceDelta: -2 },
    { id: 'M', labelAr: 'وسط', labelEn: 'Medium', priceDelta: 0 },
    { id: 'L', labelAr: 'كبير', labelEn: 'Large', priceDelta: 3 },
  ],
  'size',
);

const MILKS: ProductAddOn[] = withFid(
  [
    { id: 'milk_regular', labelAr: 'عادي', labelEn: 'Regular', priceDelta: 0, group: 'milk' as const },
    { id: 'milk_skim', labelAr: 'خالي الدسم', labelEn: 'Skim', priceDelta: 0, group: 'milk' as const },
    { id: 'milk_almond', labelAr: 'حليب لوز', labelEn: 'Almond', priceDelta: 3, group: 'milk' as const },
    { id: 'milk_oat', labelAr: 'حليب شوفان', labelEn: 'Oat', priceDelta: 3, group: 'milk' as const },
  ],
  'milk',
);

const EXTRAS: ProductAddOn[] = withFid(
  [
    { id: 'extra_shot', labelAr: 'شوت إضافي', labelEn: 'Extra shot', priceDelta: 4, group: 'extra' as const },
    { id: 'extra_vanilla', labelAr: 'فانيلا', labelEn: 'Vanilla', priceDelta: 2, group: 'extra' as const },
    { id: 'extra_caramel', labelAr: 'كراميل', labelEn: 'Caramel', priceDelta: 2, group: 'extra' as const },
  ],
  'extra',
);

const coffeeAddOns = [...MILKS, ...EXTRAS];

// Helper to reduce repetition ------------------------------------------------
type Seed = Partial<Product> &
  Pick<Product, 'id' | 'nameAr' | 'nameEn' | 'price' | 'categoryId' | 'emoji'>;

function make(seed: Seed): Product {
  return {
    foodicsId: foodicsId(`product:${seed.id}`),
    descriptionAr: '',
    descriptionEn: '',
    image: null,
    calories: undefined,
    sizes: [],
    addOns: [],
    isAvailable: true,
    isFeatured: false,
    tags: [],
    preparationTime: 5,
    rating: 4.7,
    ...seed,
  };
}

export const products: Product[] = [
  // ── Hot coffee ──
  make({
    id: 'cap', nameAr: 'كابتشينو', nameEn: 'Cappuccino', price: 18, categoryId: 'hot', emoji: '☕',
    descriptionAr: 'إسبريسو مع حليب مبخّر ورغوة مخمليّة', descriptionEn: 'Espresso with steamed milk and velvety foam',
    sizes: SIZES, addOns: coffeeAddOns, calories: 120, preparationTime: 4, isFeatured: false,
    tags: ['الأكثر طلبًا'], rating: 4.8,
  }),
  make({
    id: 'flat', nameAr: 'فلات وايت', nameEn: 'Flat White', price: 20, categoryId: 'hot', emoji: '☕',
    descriptionAr: 'إسبريسو مزدوج مع حليب حريري', descriptionEn: 'Double espresso with silky milk',
    sizes: SIZES, addOns: coffeeAddOns, calories: 150, preparationTime: 4, rating: 4.9,
  }),
  make({
    id: 'latte', nameAr: 'لاتيه', nameEn: 'Latte', price: 19, categoryId: 'hot', emoji: '☕',
    descriptionAr: 'إسبريسو مع حليب مبخّر ناعم', descriptionEn: 'Espresso with smooth steamed milk',
    sizes: SIZES, addOns: coffeeAddOns, calories: 190, preparationTime: 4,
  }),
  make({
    id: 'esp', nameAr: 'إسبريسو', nameEn: 'Espresso', price: 14, categoryId: 'hot', emoji: '☕',
    descriptionAr: 'جرعة مركّزة من حبّتنا المختصّة', descriptionEn: 'A concentrated shot of our specialty bean',
    sizes: [], addOns: EXTRAS, calories: 5, preparationTime: 3,
  }),
  make({
    id: 'spanish', nameAr: 'سبانش لاتيه', nameEn: 'Spanish Latte', price: 21, categoryId: 'hot', emoji: '☕',
    descriptionAr: 'لاتيه بحليب مكثّف محلّى', descriptionEn: 'Latte with sweetened condensed milk',
    sizes: SIZES, addOns: coffeeAddOns, calories: 220, preparationTime: 4, rating: 4.8,
  }),

  // ── Cold coffee ──
  make({
    id: 'icelatte', nameAr: 'آيس لاتيه', nameEn: 'Iced Latte', price: 20, categoryId: 'cold', emoji: '🧊',
    descriptionAr: 'إسبريسو على الثلج مع حليب بارد', descriptionEn: 'Espresso over ice with cold milk',
    sizes: SIZES, addOns: coffeeAddOns, calories: 160, preparationTime: 4,
  }),
  make({
    id: 'icespanish', nameAr: 'آيس سبانش', nameEn: 'Iced Spanish Latte', price: 23, categoryId: 'cold', emoji: '🧊',
    descriptionAr: 'سبانش لاتيه بارد ومنعش', descriptionEn: 'Chilled, refreshing Spanish latte',
    sizes: SIZES, addOns: coffeeAddOns, calories: 240, preparationTime: 4, isFeatured: true,
    tags: ['منعش'], rating: 4.9,
  }),
  make({
    id: 'coldbrew', nameAr: 'كولد برو', nameEn: 'Cold Brew', price: 22, categoryId: 'cold', emoji: '🧊',
    descriptionAr: 'نقع بارد ١٨ ساعة بقوام ناعم', descriptionEn: '18-hour cold steep, smooth body',
    sizes: SIZES, addOns: EXTRAS, calories: 15, preparationTime: 3,
  }),

  // ── V60 / filter ──
  make({
    id: 'v60rw', nameAr: 'في٦٠ ريد واين', nameEn: 'V60 Red Wine Harvest', price: 28, categoryId: 'v60', emoji: '🫖',
    descriptionAr: 'تخمير يدوي بنوتات فاكهية تشبه النبيذ', descriptionEn: 'Hand brew with wine-like fruity notes',
    sizes: [], addOns: [], calories: 5, preparationTime: 8, isFeatured: true,
    tags: ['الأكثر مبيعًا'], rating: 4.9,
  }),
  make({
    id: 'icev60', nameAr: 'آيس في٦٠ إثيوبي', nameEn: 'Iced V60 Ethiopia', price: 25, categoryId: 'v60', emoji: '🫖',
    descriptionAr: 'مقطّرة باردة بنكهات زهرية وحمضية', descriptionEn: 'Iced pour-over, floral and bright',
    sizes: [], addOns: [], calories: 5, preparationTime: 8, isFeatured: true, isAvailable: false,
    tags: ['جديد'], rating: 4.8,
  }),
  make({
    id: 'v60col', nameAr: 'في٦٠ كولومبي', nameEn: 'V60 Colombia', price: 26, categoryId: 'v60', emoji: '🫖',
    descriptionAr: 'حلاوة كراميل وقوام متوازن', descriptionEn: 'Caramel sweetness, balanced body',
    sizes: [], addOns: [], calories: 5, preparationTime: 8, rating: 4.7,
  }),

  // ── Matcha ──
  make({
    id: 'matchalatte', nameAr: 'ماتشا لاتيه', nameEn: 'Matcha Latte', price: 24, categoryId: 'matcha', emoji: '🍵',
    descriptionAr: 'ماتشا يابانية مع حليب مبخّر', descriptionEn: 'Japanese matcha with steamed milk',
    sizes: SIZES, addOns: MILKS, calories: 180, preparationTime: 5, isFeatured: true,
    tags: ['نباتي'], rating: 4.8,
  }),
  make({
    id: 'icematcha', nameAr: 'آيس ماتشا', nameEn: 'Iced Matcha', price: 25, categoryId: 'matcha', emoji: '🍵',
    descriptionAr: 'ماتشا باردة بطبقات الحليب', descriptionEn: 'Iced layered matcha',
    sizes: SIZES, addOns: MILKS, calories: 190, preparationTime: 5, rating: 4.7,
  }),

  // ── Bakery ──
  make({
    id: 'croissant', nameAr: 'كرواسون لوز', nameEn: 'Almond Croissant', price: 16, categoryId: 'bakery', emoji: '🥐',
    descriptionAr: 'طبقات زبدية محشوّة باللوز', descriptionEn: 'Buttery layers filled with almond',
    calories: 320, preparationTime: 2, rating: 4.8,
  }),
  make({
    id: 'butter_croissant', nameAr: 'كرواسون سادة', nameEn: 'Butter Croissant', price: 13, categoryId: 'bakery', emoji: '🥐',
    descriptionAr: 'كلاسيكي مقرمش بالزبدة', descriptionEn: 'Classic crisp butter croissant',
    calories: 270, preparationTime: 2,
  }),
  make({
    id: 'cinnamon', nameAr: 'سينامون رول', nameEn: 'Cinnamon Roll', price: 18, categoryId: 'bakery', emoji: '🥨',
    descriptionAr: 'لفائف قرفة بصلصة الجبن الكريمي', descriptionEn: 'Cinnamon rolls with cream cheese glaze',
    calories: 420, preparationTime: 3, rating: 4.9,
  }),

  // ── Desserts ──
  make({
    id: 'cheese', nameAr: 'تشيز كيك', nameEn: 'Cheesecake', price: 24, categoryId: 'dessert', emoji: '🍰',
    descriptionAr: 'كلاسيكي كريمي على قاعدة بسكويت', descriptionEn: 'Creamy classic on a biscuit base',
    calories: 450, preparationTime: 2, rating: 4.8,
  }),
  make({
    id: 'cookie', nameAr: 'كوكيز', nameEn: 'Chocolate Cookie', price: 12, categoryId: 'dessert', emoji: '🍪',
    descriptionAr: 'كوكيز شوكولاتة طري من الفرن', descriptionEn: 'Soft-baked chocolate cookie',
    calories: 280, preparationTime: 2, isAvailable: false,
  }),
  make({
    id: 'brownie', nameAr: 'براوني', nameEn: 'Fudge Brownie', price: 17, categoryId: 'dessert', emoji: '🍫',
    descriptionAr: 'براوني شوكولاتة داكنة كثيف', descriptionEn: 'Dense dark-chocolate brownie',
    calories: 410, preparationTime: 2, rating: 4.7,
  }),

  // ── Sandwiches ──
  make({
    id: 'halloumi', nameAr: 'ساندويتش حلومي', nameEn: 'Halloumi Sandwich', price: 26, categoryId: 'sandwiches', emoji: '🥪',
    descriptionAr: 'حلومي مشوي مع خضار وبيستو', descriptionEn: 'Grilled halloumi, greens and pesto',
    calories: 480, preparationTime: 7, rating: 4.7,
  }),
  make({
    id: 'chicken', nameAr: 'ساندويتش دجاج', nameEn: 'Chicken Sandwich', price: 28, categoryId: 'sandwiches', emoji: '🥪',
    descriptionAr: 'دجاج متبّل مع صوص الثوم', descriptionEn: 'Spiced chicken with garlic sauce',
    calories: 520, preparationTime: 8,
  }),

  // ── Water ──
  make({
    id: 'water_still', nameAr: 'مياه', nameEn: 'Still Water', price: 3, categoryId: 'water', emoji: '💧',
    descriptionAr: 'مياه نقية ٦٠٠ مل', descriptionEn: 'Still water 600ml', preparationTime: 1,
  }),
  make({
    id: 'water_sparkling', nameAr: 'مياه فوارة', nameEn: 'Sparkling Water', price: 7, categoryId: 'water', emoji: '🫧',
    descriptionAr: 'مياه غازية منعشة ٣٣٠ مل', descriptionEn: 'Sparkling water 330ml', preparationTime: 1,
  }),
];

export const productById = (id: string) => products.find((p) => p.id === id);
export const featuredProducts = () => products.filter((p) => p.isFeatured);
export const productsByCategory = (categoryId: string) =>
  products.filter((p) => p.categoryId === categoryId);
