/**
 * Shared test helpers: a supertest agent bound to the real app, a login helper
 * that returns tokens, and a tiny product fixture for order tests.
 */
import request from 'supertest';
import { app } from '../app';
import { prisma } from '../database/prisma';

export const api = () => request(app);

export interface AuthResult {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  customer: { id: string; phone: string };
}

/** Run the mock OTP flow for a phone and return tokens + customer. */
export async function loginAs(phone: string): Promise<AuthResult> {
  await api().post('/api/auth/login').send({ phone });
  const res = await api().post('/api/auth/verify').send({ phone, code: '1234' });
  return res.body.data as AuthResult;
}

/** Bearer header helper. */
export const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

/** Create a category + product and return the product id (for order tests). */
export async function seedProduct(): Promise<string> {
  const category = await prisma.category.create({ data: { nameAr: 'فئة اختبار', sortOrder: 0 } });
  const product = await prisma.product.create({
    data: { categoryId: category.id, nameAr: 'قهوة اختبار', price: 1500, isAvailable: true },
  });
  return product.id;
}
