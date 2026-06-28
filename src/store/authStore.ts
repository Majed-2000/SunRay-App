import { create } from 'zustand';
import type { User } from '@/types';
import { mockUser } from '@/data';
import { setLocale, type LocaleCode } from '@/i18n';
import { request, USE_BACKEND } from '@/services/api';
import { mapCustomer, type CustomerDTO } from '@/services/dto';

interface AuthState {
  user: User | null;
  token: string | null; // backend session token (mock/fake for now)
  isAuthenticated: boolean;
  isGuest: boolean;
  hasOnboarded: boolean;
  locale: LocaleCode;
  pendingPhone: string; // local form during login → OTP

  setLocale: (locale: LocaleCode) => void;
  completeOnboarding: () => void;
  setPendingPhone: (phone: string) => void;
  /** Step 1: request an OTP for this phone. Returns true on success. */
  requestOtp: (phone: string) => Promise<boolean>;
  /** Step 2: verify the code → sign in. Returns true on success. (Mock: any 4 digits.) */
  verifyOtp: (code: string) => Promise<boolean>;
  continueAsGuest: () => void;
  updateProfile: (
    patch: Partial<Pick<User, 'name' | 'email' | 'gender' | 'city' | 'birthDay' | 'birthMonth'>>,
  ) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: null,
  isAuthenticated: false,
  isGuest: false,
  hasOnboarded: false,
  locale: 'ar',
  pendingPhone: '',

  setLocale: (locale) => {
    setLocale(locale);
    set({ locale });
  },
  completeOnboarding: () => set({ hasOnboarded: true }),
  setPendingPhone: (phone) => set({ pendingPhone: phone }),

  requestOtp: async (phone) => {
    set({ pendingPhone: phone });
    if (!USE_BACKEND) return true; // mock: nothing to send
    try {
      await request('/api/auth/login', { method: 'POST', body: { phone } });
      return true;
    } catch {
      return false;
    }
  },

  verifyOtp: async (code) => {
    const phone = get().pendingPhone || mockUser.phone;
    if (!USE_BACKEND) {
      // Mock sign-in (unchanged behavior).
      set({ user: { ...mockUser, phone }, token: 'mock-token', isAuthenticated: true, isGuest: false });
      return true;
    }
    try {
      const data = await request<{ token: string; customer: CustomerDTO }>('/api/auth/verify', {
        method: 'POST',
        body: { phone, code },
      });
      set({
        user: mapCustomer(data.customer),
        token: data.token,
        isAuthenticated: true,
        isGuest: false,
      });
      return true;
    } catch {
      return false;
    }
  },

  continueAsGuest: () =>
    set({
      user: { ...mockUser, name: 'ضيف', avatarText: 'ض' },
      token: null,
      isAuthenticated: true,
      isGuest: true,
    }),

  updateProfile: (patch) =>
    set((s) =>
      s.user
        ? {
            user: {
              ...s.user,
              ...patch,
              avatarText: patch.name ? patch.name.trim().charAt(0) || s.user.avatarText : s.user.avatarText,
            },
          }
        : s,
    ),

  logout: () =>
    set({ user: null, token: null, isAuthenticated: false, isGuest: false, pendingPhone: '' }),
}));
