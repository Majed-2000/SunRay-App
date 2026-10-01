import type { GiftDesign } from '@/types';

/**
 * Gift card faces — the three sunray.sa offers, in its order.
 *
 * The app used to ship three gradients of its own (gold, charcoal, olive) that
 * the server had never heard of: `updateGiftCardDetails` accepts `sunray`,
 * `graduation` and `custom`, and the recipient's page draws the face from the
 * site's own `bg_<design>.svg`. A design picked here has to be one the
 * recipient will actually see, so these are the site's ids and names, and the
 * art is the site's file (`components/GiftCardPreview.tsx` loads it).
 */
export const giftDesigns: GiftDesign[] = [
  { id: 'sunray', nameAr: 'إشراقة الشمس' },
  { id: 'graduation', nameAr: 'فرحة التخرّج' },
  // Recoloured by the sender: one colour for the pattern, one for the ground.
  { id: 'custom', nameAr: 'على كيفك' },
];

export const giftDesignById = (id: string | undefined | null): GiftDesign =>
  giftDesigns.find((d) => d.id === id) ?? giftDesigns[0];
