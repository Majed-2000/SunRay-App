/**
 * Customer "service" = the database logic for customers. Routes stay thin and
 * just call these functions. This separation makes the code easy to read/test.
 */
import { Gender } from '@prisma/client';
import type { Address, Customer } from '@prisma/client';
import { prisma } from '../../database/prisma';
import { NotFound } from '../../common/errors';
import type { AddAddressInput, UpdateProfileInput } from './customers.schemas';

type CustomerWithAddresses = Customer & { addresses: Address[] };

/** Shape a DB customer into a clean JSON object for the app. */
export function toCustomerDTO(c: CustomerWithAddresses) {
  return {
    id: c.id,
    name: c.name,
    phone: c.phone,
    countryCode: '+966',
    email: c.email ?? undefined,
    gender: fromDbGender(c.gender),
    city: c.city ?? undefined,
    birthDay: c.birthDay ?? undefined,
    birthMonth: c.birthMonth ?? undefined,
    addresses: c.addresses.map(toAddressDTO),
    createdAt: c.createdAt.getTime(),
  };
}

export function toAddressDTO(a: Address) {
  return {
    id: a.id,
    label: a.label,
    city: a.city,
    district: a.district ?? undefined,
    street: a.street ?? undefined,
    details: a.details ?? undefined,
    latitude: a.latitude ?? undefined,
    longitude: a.longitude ?? undefined,
  };
}

export async function getCustomerById(id: string) {
  const customer = await prisma.customer.findUnique({
    where: { id },
    include: { addresses: true },
  });
  if (!customer) throw NotFound('العميل غير موجود');
  return toCustomerDTO(customer);
}

/** Used by auth: find a customer by phone, or create a new one. */
export async function findOrCreateByPhone(phone: string) {
  const existing = await prisma.customer.findUnique({
    where: { phone },
    include: { addresses: true },
  });
  if (existing) return existing;
  return prisma.customer.create({
    data: { phone, name: 'ضيف سن راي' },
    include: { addresses: true },
  });
}

/**
 * The API contract uses lowercase 'male'/'female' — that is what the app has
 * always sent and changing it would break every installed build. The database
 * uses a Gender enum. These two functions are the only place the two spellings
 * meet; nothing else should translate between them.
 */
function toDbGender(g?: 'male' | 'female'): Gender | undefined {
  if (!g) return undefined;
  return g === 'male' ? Gender.MALE : Gender.FEMALE;
}

function fromDbGender(g: Gender | null): 'male' | 'female' | undefined {
  if (!g) return undefined;
  return g === Gender.MALE ? 'male' : 'female';
}

export async function updateProfile(id: string, patch: UpdateProfileInput) {
  await ensureExists(id);
  const updated = await prisma.customer.update({
    where: { id },
    data: {
      name: patch.name,
      email: patch.email === '' ? null : patch.email,
      gender: toDbGender(patch.gender),
      city: patch.city,
      birthDay: patch.birthDay,
      birthMonth: patch.birthMonth,
    },
    include: { addresses: true },
  });
  return toCustomerDTO(updated);
}

export async function listAddresses(customerId: string) {
  await ensureExists(customerId);
  const addresses = await prisma.address.findMany({
    where: { customerId },
    orderBy: { createdAt: 'desc' },
  });
  return addresses.map(toAddressDTO);
}

export async function addAddress(customerId: string, input: AddAddressInput) {
  await ensureExists(customerId);
  const address = await prisma.address.create({
    data: { customerId, ...input },
  });
  return toAddressDTO(address);
}

async function ensureExists(id: string) {
  const found = await prisma.customer.findUnique({ where: { id }, select: { id: true } });
  if (!found) throw NotFound('العميل غير موجود');
}
