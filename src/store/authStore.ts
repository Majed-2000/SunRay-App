import { create } from 'zustand';
import type { User } from '@/types';
import { mockUser } from '@/data';
import { setLocale, type LocaleCode } from '@/i18n';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isGuest: boolean;
  hasOnboarded: boolean;
  locale: LocaleCode;
  pendingPhone: string; // local form during login → OTP

  setLocale: (locale: LocaleCode) => void;
  completeOnboarding: () => void;
  setPendingPhone: (phone: string) => void;
  /** Verify OTP (mock: any 4 digits) → sign in as the mock user. */
  verifyOtp: () => void;
  continueAsGuest: () => void;
  updateProfile: (
    patch: Partial<Pick<User, 'name' | 'email' | 'gender' | 'city' | 'birthDay' | 'birthMonth'>>,
  ) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
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
  verifyOtp: () => {
    const phone = get().pendingPhone || mockUser.phone;
    set({
      user: { ...mockUser, phone },
      isAuthenticated: true,
      isGuest: false,
    });
  },
  continueAsGuest: () =>
    set({
      user: { ...mockUser, name: 'ضيف', avatarText: 'ض' },
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
    set({ user: null, isAuthenticated: false, isGuest: false, pendingPhone: '' }),
}));
