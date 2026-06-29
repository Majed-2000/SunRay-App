import type { Branch } from '@prisma/client';
import { prisma } from '../../database/prisma';
import { cached } from '../../common/cache';

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
  return cached('branches', 60_000, async () => {
    const branches = await prisma.branch.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'asc' },
    });
    return branches.map(toBranchDTO);
  });
}
