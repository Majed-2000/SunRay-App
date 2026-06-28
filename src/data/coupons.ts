import type { Coupon } from '@/types';

export const coupons: Coupon[] = [
  {
    code: 'SUN10',
    kind: 'percent',
    value: 10,
    titleAr: 'خصم ١٠٪',
    descriptionAr: 'خصم ١٠٪ على كامل الطلب',
  },
  {
    code: 'COFFEE20',
    kind: 'percent',
    value: 20,
    titleAr: 'خصم ٢٠٪ على القهوة',
    descriptionAr: 'خصم ٢٠٪ على القهوة الساخنة',
    appliesToCategory: 'hot',
  },
  {
    code: 'WELCOME',
    kind: 'fixed',
    value: 15,
    titleAr: 'هدية الترحيب',
    descriptionAr: 'خصم ١٥ ﷼ على طلبك الأول',
    firstOrderOnly: true,
    minSubtotal: 30,
  },
];

export const couponByCode = (code: string) =>
  coupons.find((c) => c.code.toUpperCase() === code.trim().toUpperCase());
