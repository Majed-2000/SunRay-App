import type { Branch } from '@/types';
import { foodicsId } from '@/utils/ids';

/** Sun Ray branches — Taif. Coordinates/hours are mock placeholders. */
type RawBranch = Omit<Branch, 'foodicsId'>;

const raw: RawBranch[] = [
  {
    id: 'gharbiya',
    nameAr: 'الحلقة الغربية',
    nameEn: 'Al Halqa Al Gharbiya',
    areaAr: 'الطائف · الحلقة الغربية',
    addressAr: 'شارع الحلقة الغربية، الطائف',
    lat: 21.2703,
    lng: 40.4158,
    isOpen: true,
    hoursAr: '٦ ص – ١٢ م',
    openingFrom: '06:00:00',
    openingTo: '00:00:00',
    distanceKm: 1.2,
    supportsDelivery: true,
    supportsDineIn: true,
  },
  {
    id: 'seil',
    nameAr: 'السيل',
    nameEn: 'Al Seil',
    areaAr: 'الطائف · السيل الكبير',
    addressAr: 'طريق السيل، الطائف',
    lat: 21.63,
    lng: 40.42,
    isOpen: true,
    hoursAr: '٦ ص – ١ ص',
    openingFrom: '06:00:00',
    openingTo: '01:00:00',
    distanceKm: 3.4,
    supportsDelivery: true,
    supportsDineIn: true,
  },
  {
    id: 'faisaliya',
    nameAr: 'الفيصلية',
    nameEn: 'Al Faisaliyah',
    areaAr: 'الطائف · حي الفيصلية',
    addressAr: 'شارع الفيصلية، الطائف',
    lat: 21.2854,
    lng: 40.4356,
    isOpen: false,
    hoursAr: '٧ ص – ١١ م',
    openingFrom: '07:00:00',
    openingTo: '23:00:00',
    distanceKm: 5.1,
    supportsDelivery: false,
    supportsDineIn: true,
  },
];

export const branches: Branch[] = raw.map((b) => ({
  ...b,
  foodicsId: foodicsId(`branch:${b.id}`),
}));

export const branchById = (id: string) => branches.find((b) => b.id === id);
export const nearestBranch = () =>
  [...branches].sort((a, b) => a.distanceKm - b.distanceKm)[0];
