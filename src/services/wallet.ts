/**
 * Wallet service interface. The wallet (stored balance + transactions) lives in
 * OUR backend database — it is not a Foodics concept. The app reads/tops-up via
 * these endpoints. No real payment is processed here in the MVP.
 */
import { request } from './api';

export interface WalletTransactionDto {
  id: string;
  type: 'topup' | 'payment' | 'refund' | 'giftPurchase' | 'reward';
  amount: number; // + credit / − debit
  titleAr: string;
  createdAt: number;
}

export interface WalletDto {
  balance: number;
  transactions: WalletTransactionDto[];
}

/** GET /api/wallet — balance + recent transactions. */
export async function getWallet(): Promise<WalletDto> {
  return request<WalletDto>('/api/wallet');
}

/**
 * POST /api/wallet/top-up — top up the wallet. In production this is preceded by
 * a real payment via the gateway (see payments.ts); the backend credits the
 * wallet only after the charge succeeds.
 */
export async function topUpWallet(amount: number): Promise<WalletDto> {
  return request<WalletDto>('/api/wallet/top-up', { method: 'POST', body: { amount } });
}
