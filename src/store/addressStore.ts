import { create } from 'zustand';
import type { Address, AddressLabel } from '@/types';
import { mockAddresses } from '@/data';

export interface NewAddressInput {
  label: AddressLabel;
  titleAr: string;
  detailsAr: string;
}

interface AddressState {
  addresses: Address[];
  add: (input: NewAddressInput) => Address;
  remove: (id: string) => void;
  setDefault: (id: string) => void;
  defaultAddress: () => Address | undefined;
}

export const useAddressStore = create<AddressState>((set, get) => ({
  addresses: mockAddresses,
  add: (input) => {
    const address: Address = {
      id: `addr-${Date.now()}`,
      label: input.label,
      titleAr: input.titleAr.trim() || 'عنوان',
      detailsAr: input.detailsAr.trim(),
      isDefault: get().addresses.length === 0,
    };
    set((s) => ({ addresses: [...s.addresses, address] }));
    return address;
  },
  remove: (id) =>
    set((s) => ({ addresses: s.addresses.filter((a) => a.id !== id) })),
  setDefault: (id) =>
    set((s) => ({
      addresses: s.addresses.map((a) => ({ ...a, isDefault: a.id === id })),
    })),
  defaultAddress: () => get().addresses.find((a) => a.isDefault) ?? get().addresses[0],
}));
