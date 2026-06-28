import type { AppNotification } from '@/types';
import { NOW_REF } from './mock';

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

/** Mock notifications (newest first). Replace with backend push later. */
export const mockNotifications: AppNotification[] = [
  {
    id: 'n1',
    type: 'orderReady',
    titleAr: 'طلبك جاهز ☕',
    bodyAr: 'طلب SR-4821 جاهز للاستلام من فرع الحلقة الغربية.',
    createdAt: NOW_REF - 1 * HOUR,
    read: false,
  },
  {
    id: 'n2',
    type: 'orderAccepted',
    titleAr: 'قبل الفرع طلبك ✓',
    bodyAr: 'بدأنا تحضير طلبك SR-4821، نراك قريبًا!',
    createdAt: NOW_REF - 2 * HOUR,
    read: false,
  },
  {
    id: 'n3',
    type: 'pointsEarned',
    titleAr: 'ربحت نقاطًا مشرقة ⭐',
    bodyAr: 'أُضيفت ٣٩ نقطة إلى رصيدك من طلبك الأخير.',
    createdAt: NOW_REF - 3 * HOUR,
    read: true,
  },
  {
    id: 'n4',
    type: 'giftReceived',
    titleAr: 'وصلتك هدية 🎁',
    bodyAr: 'أرسلت لك سارة بطاقة إهداء بقيمة ١٠٠ ﷼ — استبدلها لتُضاف إلى محفظتك.',
    createdAt: NOW_REF - 1 * DAY,
    read: true,
  },
  {
    id: 'n5',
    type: 'birthdayOffer',
    titleAr: 'عرض عيد ميلادك قادم 🎂',
    bodyAr: 'أضف يوم وشهر ميلادك من ملفك لتصلك هدية مشرقة في يومك المميز.',
    createdAt: NOW_REF - 3 * DAY,
    read: true,
  },
];
