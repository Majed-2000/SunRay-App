/**
 * A single shared PrismaClient instance for the whole app.
 *
 * Prisma is our "database toolkit": instead of writing raw SQL, we call methods
 * like `prisma.product.findMany()` and Prisma talks to the database for us.
 * We create ONE client and reuse it everywhere (creating many is wasteful).
 */
import { PrismaClient } from '@prisma/client';
import { isProd } from '../config/env';

export const prisma = new PrismaClient({
  log: isProd ? ['error'] : ['warn', 'error'],
});
