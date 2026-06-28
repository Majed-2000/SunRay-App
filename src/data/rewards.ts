import type { Reward } from '@/types';

export const rewards: Reward[] = [
  { id: 'free_flat', nameAr: 'فلات وايت مجاني', nameEn: 'Free Flat White', emoji: '☕', cost: 200, kind: 'freeItem' },
  { id: 'free_pourover', nameAr: 'قهوة مقطّرة مجانية', nameEn: 'Free Pour Over', emoji: '🫖', cost: 200, kind: 'freeItem' },
  { id: 'free_dessert', nameAr: 'قطعة حلى', nameEn: 'Free Dessert', emoji: '🍰', cost: 150, kind: 'freeItem' },
  { id: 'size_up', nameAr: 'ترقية حجم', nameEn: 'Size Upgrade', emoji: '⬆️', cost: 80, kind: 'sizeUpgrade' },
  { id: 'discount25', nameAr: 'خصم ٢٥٪', nameEn: '25% Off', emoji: '🎟️', cost: 100, kind: 'discount', value: 25 },
  { id: 'wallet15', nameAr: 'شحن محفظة ١٥ ﷼', nameEn: 'Wallet +15', emoji: '👛', cost: 120, kind: 'walletTopup', value: 15 },
];
