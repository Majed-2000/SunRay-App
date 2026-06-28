import { create } from 'zustand';
import type { GiftCard } from '@/types';
import { mockGiftCards } from '@/data';
import { CONFIG } from '@/constants/config';
import { useWalletStore } from './walletStore';
import { toast } from './uiStore';

/**
 * MOCK gift card store.
 *
 * A gift card carries a stored VALUE: when the recipient redeems it, that amount
 * is added to the RECIPIENT'S WALLET balance, which they then spend on orders.
 *
 * In production this happens on the BACKEND, never in the app:
 *  - Issuance: backend sells an open-price Gift Card Product inside a Foodics
 *    order and returns the real code + balance (services/giftCards.ts, §9).
 *  - Redemption: backend validates the code, decrements the Foodics gift card,
 *    and credits our wallet ledger.
 * A gift card CODE is CASH — never expose it in a URL/query/log; the gift detail
 * route uses the card `id`, not the code. `redeem` below mocks the wallet credit.
 */

export interface CreateGiftInput {
  amount: number;
  designId: string;
  senderName: string;
  recipientName: string;
  recipientPhone: string;
  message: string;
}

interface GiftState {
  cards: GiftCard[];
  createGift: (input: CreateGiftInput) => GiftCard;
  /** Redeem a received card → credit the recipient wallet (mock). Returns success. */
  redeem: (id: string) => boolean;
  getById: (id: string) => GiftCard | undefined;
}

function generateCode(): string {
  const block = () => Math.floor(1000 + Math.random() * 9000);
  return `${CONFIG.GIFT_CODE_PREFIX}-${block()}-${block()}`;
}

export const useGiftStore = create<GiftState>((set, get) => ({
  cards: mockGiftCards,
  createGift: (input) => {
    const card: GiftCard = {
      id: `gift-${Date.now()}`,
      code: generateCode(),
      amount: input.amount,
      designId: input.designId,
      senderName: input.senderName.trim() || 'صديقك',
      recipientName: input.recipientName.trim() || 'عزيزي',
      recipientPhone: input.recipientPhone,
      message: input.message.trim(),
      status: 'active',
      createdAt: Date.now(),
      direction: 'sent',
    };
    set((s) => ({ cards: [card, ...s.cards] }));
    return card;
  },

  redeem: (id) => {
    const card = get().cards.find((c) => c.id === id);
    if (!card) return false;
    if (card.status !== 'active') {
      toast('هذه البطاقة غير قابلة للاستبدال');
      return false;
    }
    // MOCK: real redemption is backend-side (validate code → credit wallet ledger).
    useWalletStore.getState().credit(card.amount, 'استبدال بطاقة إهداء', 'giftPurchase');
    set((s) => ({ cards: s.cards.map((c) => (c.id === id ? { ...c, status: 'used' } : c)) }));
    toast('تمت إضافة الرصيد إلى محفظتك 🎉');
    return true;
  },

  getById: (id) => get().cards.find((c) => c.id === id),
}));
