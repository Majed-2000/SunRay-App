import type { GiftDesign } from '@/types';

export const giftDesigns: GiftDesign[] = [
  {
    id: 'terracotta',
    nameAr: 'تراكوتا',
    gradient: ['#b5662e', '#9c4f20'],
    shadowColor: 'rgba(181,102,46,0.35)',
    labelColor: 'rgba(255,220,170,0.85)',
  },
  {
    id: 'gold',
    nameAr: 'ذهبي',
    gradient: ['#e7ad30', '#cf8b22'],
    shadowColor: 'rgba(190,130,30,0.35)',
    labelColor: 'rgba(90,63,18,0.85)',
  },
  {
    id: 'dark',
    nameAr: 'داكن',
    gradient: ['#2a2018', '#4a3820'],
    shadowColor: 'rgba(42,32,24,0.4)',
    labelColor: 'rgba(245,201,106,0.85)',
  },
];

export const giftDesignById = (id: string) =>
  giftDesigns.find((d) => d.id === id) ?? giftDesigns[1];
