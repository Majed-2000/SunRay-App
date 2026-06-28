/**
 * Zod schemas validate request bodies BEFORE we trust them. If the data is
 * invalid, parsing throws a ZodError which the error handler turns into a 422.
 */
import { z } from 'zod';

export const updateProfileSchema = z.object({
  name: z.string().min(1).max(60).optional(),
  email: z.string().email().optional().or(z.literal('')),
  gender: z.enum(['male', 'female']).optional(),
  city: z.string().min(1).max(60).optional(),
  birthDay: z.number().int().min(1).max(31).optional(),
  birthMonth: z.number().int().min(1).max(12).optional(),
});

export const addAddressSchema = z.object({
  label: z.enum(['home', 'work', 'other']).default('home'),
  city: z.string().min(1).max(60),
  district: z.string().max(80).optional(),
  street: z.string().max(120).optional(),
  details: z.string().max(200).optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type AddAddressInput = z.infer<typeof addAddressSchema>;
