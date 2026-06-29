import { z } from 'zod';

// Saudi local mobile: 9 digits starting with 5 (e.g. 501234567).
const saudiPhone = z.string().regex(/^5\d{8}$/, 'رقم جوال سعودي غير صحيح');

export const loginSchema = z.object({
  phone: saudiPhone,
});

export const verifySchema = z.object({
  phone: saudiPhone,
  code: z.string().regex(/^\d{4}$/, 'رمز التحقق يجب أن يكون ٤ أرقام'),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(20, 'رمز التحديث غير صالح'),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type VerifyInput = z.infer<typeof verifySchema>;
export type RefreshInput = z.infer<typeof refreshSchema>;
