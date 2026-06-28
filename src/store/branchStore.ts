import { create } from 'zustand';
import { branches as mockBranches } from '@/data';
import type { Branch } from '@/types';
import { request, USE_BACKEND } from '@/services/api';
import { mapBranch, type BranchDTO } from '@/services/dto';

type Status = 'idle' | 'loading' | 'ready' | 'error';

interface BranchState {
  branches: Branch[];
  selectedBranchId: string;
  auto: boolean; // true = "nearest branch" auto mode
  status: Status;
  error: string | null;
  load: () => Promise<void>;
  selectBranch: (id: string) => void;
  selectNearest: () => void;
  current: () => Branch;
}

const nearest = (list: Branch[]) => [...list].sort((a, b) => a.distanceKm - b.distanceKm)[0];

export const useBranchStore = create<BranchState>((set, get) => ({
  // Always start with mock branches so `current()` never returns undefined while
  // a backend list is loading. In backend mode `load()` replaces them.
  branches: mockBranches,
  selectedBranchId: nearest(mockBranches).id,
  auto: true,
  status: USE_BACKEND ? 'loading' : 'ready',
  error: null,

  load: async () => {
    if (!USE_BACKEND) {
      set({ branches: mockBranches, status: 'ready', error: null });
      return;
    }
    set({ status: 'loading', error: null });
    try {
      const dtos = await request<BranchDTO[]>('/api/branches');
      const branches = dtos.map(mapBranch);
      if (branches.length === 0) {
        set({ status: 'ready' }); // keep mock fallback if backend returns none
        return;
      }
      set({
        branches,
        selectedBranchId: get().auto ? nearest(branches).id : (branches.find((b) => b.id === get().selectedBranchId)?.id ?? branches[0].id),
        status: 'ready',
        error: null,
      });
    } catch (e) {
      set({ status: 'error', error: e instanceof Error ? e.message : 'تعذّر تحميل الفروع' });
    }
  },

  selectBranch: (id) => set({ selectedBranchId: id, auto: false }),
  selectNearest: () => set({ selectedBranchId: nearest(get().branches).id, auto: true }),
  current: () => {
    const { branches, selectedBranchId } = get();
    return branches.find((b) => b.id === selectedBranchId) ?? branches[0];
  },
}));
