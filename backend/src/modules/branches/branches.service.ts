import type { Branch } from '@prisma/client';
import { prisma } from '../../database/prisma';

export function toBranchDTO(b: Branch) {
  return {
    id: b.id,
    name: b.name,
    address: b.address ?? undefined,
    latitude: b.latitude ?? undefined,
    longitude: b.longitude ?? undefined,
    openingFrom: b.openingFrom ?? undefined,
    openingTo: b.openingTo ?? undefined,
    isActive: b.isActive,
  };
}

export async function listBranches() {
  const branches = await prisma.branch.findMany({
    where: { isActive: true },
    orderBy: { createdAt: 'asc' },
  });
  return branches.map(toBranchDTO);
}
