/** Arabic strings. This is the source-of-truth shape for all locales. */
export const ar = {
  common: {
    appName: 'سن راي',
    tagline: 'دائمًا كن مشرقًا',
    taglineEn: 'ALWAYS BE RADIANT',
    riyal: '﷼',
    back: 'رجوع',
    next: 'التالي',
    confirm: 'تأكيد',
    cancel: 'إلغاء',
    save: 'حفظ',
    done: 'تم',
    add: 'إضافة',
    edit: 'تعديل',
    delete: 'حذف',
    close: 'إغلاق',
    seeAll: 'عرض الكل',
    soon: 'قريبًا ☀',
    points: 'نقطة',
    retry: 'إعادة المحاولة',
    or: 'أو',
    skip: 'تخطّي',
  },
  tabs: {
    home: 'الرئيسية',
    menu: 'القائمة',
    orders: 'الطلبات',
    loyalty: 'الولاء',
    account: 'حسابي',
  },
  // Customer-facing order stages (derived from Foodics status/deliveryStatus).
  orderStage: {
    pending: 'بانتظار قبول الفرع',
    preparing: 'قيد التحضير',
    ready: 'جاهز للاستلام',
    enRoute: 'في الطريق إليك',
    completed: 'مكتمل',
    cancelled: 'ملغي',
  },
  orderStageEn: {
    pending: 'Pending',
    preparing: 'Preparing',
    ready: 'Ready',
    enRoute: 'On the way',
    completed: 'Completed',
    cancelled: 'Cancelled',
  },
  orderType: {
    pickup: 'استلام من الفرع',
    delivery: 'توصيل',
    dineIn: 'تناول داخل الفرع',
  },
  tier: {
    bronze: 'برونزي',
    silver: 'فضي',
    gold: 'ذهبي',
  },
  giftStatus: {
    active: 'نشطة',
    used: 'مستخدمة',
    expired: 'منتهية',
  },
  empty: {
    cart: 'سلّتك فاضية',
    cartHint: 'أضف مشروبك المفضل وابدأ يومك مشرقًا',
    orders: 'لا توجد طلبات بعد',
    ordersHint: 'أول طلب لك على بُعد نقرة واحدة',
    wallet: 'لا توجد عمليات بعد',
    gifts: 'لا توجد بطاقات إهداء',
  },
} as const;

export type Dictionary = typeof ar;
