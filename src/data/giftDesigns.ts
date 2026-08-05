import type { GiftDesign } from '@/types';

/**
 * Gift card faces, rebuilt on the brand palette.
 *
 * The three designs were terracotta, amber and warm brown — none of which
 * exists in the identity. They are now the three surfaces the brand actually
 * has: Radiant Gold, Deep Charcoal, and Olive, which is where the secondary
 * accent earns its keep. A gift card is a product, not app chrome, so it is the
 * right place for the fuller palette.
 *
 * ⚠️ Olive takes light labels only. Charcoal on olive is 2.15:1 and is named a
 * forbidden pairing in the guidelines.
 */
export const giftDesigns: GiftDesign[] = [
  {
    id: 'gold',
    nameAr: 'ذهبي',
    gradient: ['#fcda4c', '#f5cf3f'],
    shadowColor: 'rgba(138,109,18,0.32)',
    labelColor: 'rgba(67,67,68,0.80)',
  },
  {
    id: 'dark',
    nameAr: 'فحمي',
    gradient: ['#434344', '#2f2f30'],
    shadowColor: 'rgba(67,67,68,0.38)',
    labelColor: 'rgba(252,218,76,0.88)',
  },
  {
    id: 'olive',
    nameAr: 'زيتي',
    gradient: ['#527f5f', '#456b50'],
    shadowColor: 'rgba(82,127,95,0.34)',
    labelColor: 'rgba(255,255,255,0.86)',
  },
];

export const giftDesignById = (id: string) =>
  giftDesigns.find((d) => d.id === id) ?? giftDesigns[0];
