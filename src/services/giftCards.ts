/**
 * Gift card service interface (`.claude/FOODICS_API.md §9`).
 *
 * SECURITY: a gift card code is CASH. Anyone holding it can spend it.
 *  - Never put a code in a URL, query string, or log → lookups use a POST body.
 *  - Deliver codes over a secure channel (SMS/email), never expose in the UI URL.
 *
 * Real issuance requires the BACKEND: a gift card is created only by SELLING a
 * Gift Card Product inside a Foodics order (there is no POST /gift_cards). The
 * backend places that order, reads the issued card's code + balance, and returns
 * it. The app only ever sees the result via our backend.
 */
import { request } from './api';
import type { GiftCard } from './foodics.types';

export interface IssueGiftCardInput {
  amount: number;
  designId: string;
  senderName: string;
  recipientName: string;
  recipientPhone: string;
  message: string;
}

/**
 * POST /api/gift-cards — backend sells an open-price Gift Card Product inside a
 * Foodics order, then returns the issued card (code + balance).
 */
export async function issueGiftCard(input: IssueGiftCardInput): Promise<GiftCard> {
  return request<GiftCard>('/api/gift-cards', { method: 'POST', body: input });
}

/**
 * Balance lookup. Uses POST (code in the BODY, not the URL) so the code never
 * lands in URLs/logs — this deliberately deviates from a `GET /:code` example
 * for security. Backend → `GET /gift_cards/{code}` (scope orders.gift_cards.read).
 */
export async function getGiftCardBalance(code: string): Promise<GiftCard> {
  return request<GiftCard>('/api/gift-cards/lookup', { method: 'POST', body: { code } });
}
