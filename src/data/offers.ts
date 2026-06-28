/** Home offer strip + offers screen content. */
export interface Offer {
  id: string;
  eyebrowAr: string;
  titleAr: string;
  subtitleAr: string;
  emoji: string;
  variant: 'dark' | 'terracotta' | 'gold';
  couponCode?: string;
}

export const offers: Offer[] = [
  {
    id: 'o1',
    eyebrowAr: 'عرض اليوم',
    titleAr: 'خصم ٢٠٪ على القهوة المقطّرة',
    subtitleAr: 'حتى نهاية الأسبوع',
    emoji: '☕',
    variant: 'dark',
    couponCode: 'COFFEE20',
  },
  {
    id: 'o2',
    eyebrowAr: 'مكافأة',
    titleAr: 'مشروبك العاشر علينا مجانًا',
    subtitleAr: 'تبقّى لك زيارتان',
    emoji: '🎁',
    variant: 'terracotta',
  },
  {
    id: 'o3',
    eyebrowAr: 'ترحيب',
    titleAr: 'خصم ١٥ ﷼ على طلبك الأول',
    subtitleAr: 'استخدم الكود WELCOME',
    emoji: '🌟',
    variant: 'gold',
    couponCode: 'WELCOME',
  },
];
