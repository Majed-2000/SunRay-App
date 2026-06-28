import { z } from 'zod';
import { ORDER_STATUSES, ORDER_TYPES } from '../cart/cart.types';

export const createOrderSchema = z.object({
  customerId: z.string().optional(),
  branchId: z.string().optional(),
  type: z.enum(ORDER_TYPES as [string, ...string[]]),
  items: z
    .array(
      z.object({
        productId: z.string().min(1),
        quantity: z.number().int().min(1).max(50),
        modifierOptionIds: z.array(z.string()).default([]),
        notes: z.string().max(200).optional(),
      }),
    )
    .min(1, 'الطلب يجب أن يحتوي على عنصر واحد على الأقل'),
  customerNotes: z.string().max(300).optional(),
  scheduledAt: z.string().datetime().optional(),
  // discount in halalas (e.g. from a coupon) — optional, defaults to 0
  discount: z.number().int().min(0).optional(),
});

export const updateStatusSchema = z.object({
  status: z.enum(ORDER_STATUSES as [string, ...string[]]),
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;
export type UpdateStatusInput = z.infer<typeof updateStatusSchema>;
