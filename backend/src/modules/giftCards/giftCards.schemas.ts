import { z } from 'zod';

export const issueGiftCardSchema = z.object({
  senderCustomerId: z.string().optional(),
  recipientPhone: z.string().regex(/^5\d{8}$/, 'رقم جوال سعودي غير صحيح'),
  recipientName: z.string().max(60).optional(),
  amount: z.number().int().min(100).max(1_000_000), // halalas (min 1 SAR)
  message: z.string().max(200).optional(),
});

export const redeemGiftCardSchema = z.object({
  // The code is CASH-like — we accept it in the body (never in the URL/logs).
  code: z.string().min(4),
  customerId: z.string().min(1),
});

export type IssueGiftCardInput = z.infer<typeof issueGiftCardSchema>;
export type RedeemGiftCardInput = z.infer<typeof redeemGiftCardSchema>;
