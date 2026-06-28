import type { Category } from '@/types';
import { foodicsId } from '@/utils/ids';

const raw: Omit<Category, 'foodicsId'>[] = [
  { id: 'hot', nameAr: 'قهوة ساخنة', nameEn: 'Hot Coffee', emoji: '☕' },
  { id: 'cold', nameAr: 'قهوة باردة', nameEn: 'Cold Coffee', emoji: '🧊' },
  { id: 'v60', nameAr: 'في٦٠', nameEn: 'V60', emoji: '🫖' },
  { id: 'matcha', nameAr: 'ماتشا', nameEn: 'Matcha', emoji: '🍵' },
  { id: 'bakery', nameAr: 'مخبوزات', nameEn: 'Bakery', emoji: '🥐' },
  { id: 'dessert', nameAr: 'حلا', nameEn: 'Desserts', emoji: '🍰' },
  { id: 'sandwiches', nameAr: 'ساندويتشات', nameEn: 'Sandwiches', emoji: '🥪' },
  { id: 'water', nameAr: 'مياه', nameEn: 'Water', emoji: '💧' },
];

// `foodicsId` is a stable mock placeholder; real ids come from Foodics via backend.
export const categories: Category[] = raw.map((c) => ({
  ...c,
  foodicsId: foodicsId(`category:${c.id}`),
}));

export const categoryById = (id: string) => categories.find((c) => c.id === id);
