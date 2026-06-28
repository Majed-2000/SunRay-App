/**
 * Payments service interface. The MVP performs NO real payments — checkout is a
 * mock that updates the local wallet/loyalty. Real payments go through OUR
 * backend + a PCI-compliant gateway (e.g. Moyasar / HyperPay); the app never
 * handles raw card data or secret keys.
 *
 * Foodics note (`.claude/FOODICS_API.md §5`): order injection accepts only
 * External (8) payments and needs Foodics approval — so the default for online
 * orders is pay-at-branch (no `payments` sent), and any collected payment is
 * reconciled by the backend.
 */
import { request } from './api';
import type { PaymentMethod } from '@/types';

export interface PaymentIntent {
  id: string;
  amount: number;
  currency: 'SAR';
  method: PaymentMethod;
  status: 'requires_action' | 'succeeded' | 'failed';
  clientSecret?: string;
}

/** POST /api/payments/intent — backend creates a gateway payment intent. */
export async function createPaymentIntent(amount: number, method: PaymentMethod): Promise<PaymentIntent> {
  return request<PaymentIntent>('/api/payments/intent', {
    method: 'POST',
    body: { amount, method },
  });
}

/** POST /api/payments/:id/confirm — backend confirms/captures the charge. */
export async function confirmPayment(intentId: string): Promise<PaymentIntent> {
  return request<PaymentIntent>(`/api/payments/${intentId}/confirm`, { method: 'POST' });
}
