import { create } from 'zustand';
import { branches, nearestBranch } from '@/data';
import type { Branch } from '@/types';

interface BranchState {
  selectedBranchId: string;
  auto: boolean; // true = "nearest branch" auto mode
  selectBranch: (id: string) => void;
  selectNearest: () => void;
  current: () => Branch;
}

export const useBranchStore = create<BranchState>((set, get) => ({
  selectedBranchId: nearestBranch().id,
  auto: true,
  selectBranch: (id) => set({ selectedBranchId: id, auto: false }),
  selectNearest: () => set({ selectedBranchId: nearestBranch().id, auto: true }),
  current: () =>
    branches.find((b) => b.id === get().selectedBranchId) ?? branches[0],
}));
