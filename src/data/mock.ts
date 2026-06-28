import type {
  User,
  Order,
  WalletTransaction,
  GiftCard,
  Address,
} from '@/types';
import { FoodicsOrderStatus, FoodicsDeliveryStatus } from '@/types';
import { foodicsId } from '@/utils/ids';

const DAY = 24 * 60 * 60 * 1000;
// Fixed reference time so mock data is deterministic (no Date.now at module load).
const NOW = 1_750_000_000_000; // ~ mid 2025

export const mockUser: User = {
  id: 'u1',
  name: 'نوف',
  phone: '501234567',
  email: 'nouf@example.com',
  gender: 'female',
  city: 'الطائف',
  // birthDay/birthMonth intentionally unset so the user can add them (birthday offers).
  avatarText: 'ن',
  joinedAt: NOW - 120 * DAY,
};

export const mockAddresses: Address[] = [
  {
    id: 'a1',
    label: 'home',
    titleAr: 'المنزل',
    detailsAr: 'حي الفيصلية، شارع ٢٠، الطائف',
    isDefault: true,
  },
  {
    id: 'a2',
    label: 'work',
    titleAr: 'العمل',
    detailsAr: 'الحلقة الغربية، مبنى النخبة، الطائف',
    isDefault: false,
  },
];

export const mockOrders: Order[] = [
  {
    id: 'SR-4821',
    foodicsOrderId: foodicsId('order:SR-4821'),
    createdAt: NOW - 2 * DAY,
    type: 'pickup',
    status: FoodicsOrderStatus.Closed,
    deliveryStatus: null,
    branchId: 'gharbiya',
    items: [
      { nameAr: 'فلات وايت', optionLabel: 'وسط · حليب شوفان', qty: 1, lineTotal: 23 },
      { nameAr: 'كرواسون لوز', optionLabel: 'قطعة', qty: 1, lineTotal: 16 },
    ],
    subtotal: 39,
    vat: 5.85,
    deliveryFee: 0,
    discount: 0,
    total: 44.85,
    paymentMethod: 'wallet',
    pointsEarned: 39,
    etaMinutes: 0,
  },
  {
    id: 'SR-4790',
    foodicsOrderId: foodicsId('order:SR-4790'),
    createdAt: NOW - 6 * DAY,
    type: 'delivery',
    status: FoodicsOrderStatus.Closed,
    deliveryStatus: FoodicsDeliveryStatus.Delivered,
    branchId: 'seil',
    addressId: 'a1',
    items: [
      { nameAr: 'آيس سبانش', optionLabel: 'كبير · عادي', qty: 2, lineTotal: 52 },
    ],
    subtotal: 52,
    vat: 7.8,
    deliveryFee: 15,
    discount: 0,
    total: 74.8,
    paymentMethod: 'card',
    pointsEarned: 52,
    etaMinutes: 0,
  },
];

export const mockWalletTx: WalletTransaction[] = [
  { id: 'w1', type: 'topup', amount: 100, titleAr: 'شحن المحفظة', createdAt: NOW - 8 * DAY },
  { id: 'w2', type: 'payment', amount: -44.85, titleAr: 'طلب SR-4821', createdAt: NOW - 2 * DAY },
  { id: 'w3', type: 'reward', amount: 15, titleAr: 'مكافأة ولاء', createdAt: NOW - 1 * DAY },
];

export const INITIAL_WALLET_BALANCE = 75;

export const mockGiftCards: GiftCard[] = [
  {
    id: 'g1',
    code: 'SR-GIFT-2048',
    amount: 100,
    designId: 'gold',
    senderName: 'سارة',
    recipientName: 'نوف',
    recipientPhone: '501234567',
    message: 'صباحك مشرق ☀',
    status: 'active',
    createdAt: NOW - 10 * DAY,
    direction: 'received',
  },
];

export const NOW_REF = NOW;
export const DAY_MS = DAY;
