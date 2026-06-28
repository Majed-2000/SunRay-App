import { create } from 'zustand';
import type { WalletTransaction, WalletTxType } from '@/types';
import { INITIAL_WALLET_BALANCE, mockWalletTx, NOW_REF } from '@/data';

interface WalletState {
  balance: number;
  transactions: WalletTransaction[];
  topup: (amount: number) => void;
  credit: (amount: number, titleAr: string, type?: WalletTxType) => void;
  /** Debit up to `amount`; returns the amount actually charged. */
  debit: (amount: number, titleAr: string) => number;
}

let txSeq = 100;
const nextId = () => `wtx-${txSeq++}`;
// Monotonic timestamps derived from the fixed reference (no Date.now in store init).
let clock = NOW_REF;
const nextTime = () => (clock += 60_000);

export const useWalletStore = create<WalletState>((set, get) => ({
  balance: INITIAL_WALLET_BALANCE,
  transactions: mockWalletTx,

  topup: (amount) =>
    set((s) => ({
      balance: s.balance + amount,
      transactions: [
        { id: nextId(), type: 'topup', amount, titleAr: 'شحن المحفظة', createdAt: nextTime() },
        ...s.transactions,
      ],
    })),

  credit: (amount, titleAr, type = 'reward') =>
    set((s) => ({
      balance: s.balance + amount,
      transactions: [
        { id: nextId(), type, amount, titleAr, createdAt: nextTime() },
        ...s.transactions,
      ],
    })),

  debit: (amount, titleAr) => {
    const charged = Math.min(amount, get().balance);
    if (charged <= 0) return 0;
    set((s) => ({
      balance: s.balance - charged,
      transactions: [
        { id: nextId(), type: 'payment', amount: -charged, titleAr, createdAt: nextTime() },
        ...s.transactions,
      ],
    }));
    return charged;
  },
}));
