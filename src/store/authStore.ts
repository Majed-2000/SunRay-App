import { create } from 'zustand';
import { router } from 'expo-router';
import type { User } from '@/types';
import { mockUser } from '@/data';
import { setLocale, type LocaleCode } from '@/i18n';
import { request, USE_BACKEND } from '@/services/api';
import {
  setAccessToken,
  getAccessToken,
  saveRefreshToken,
  loadRefreshToken,
  refreshAccessToken,
  clearSession,
  registerSessionHandlers,
} from '@/services/session';
import { mapCustomer, type CustomerDTO } from '@/services/dto';

interface VerifyResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  customer: CustomerDTO;
}

interface AuthState {
  user: User | null;
  token: string | null; // current access token (backend mode) or 'mock-token'
  isAuthenticated: boolean;
  isGuest: boolean;
  hasOnboarded: boolean;
  locale: LocaleCode;
  pendingPhone: string; // local form during login → OTP
  /** True while we try to restore a saved session on app start (backend mode). */
  isHydrating: boolean;

  setLocale: (locale: LocaleCode) => void;
  completeOnboarding: () => void;
  setPendingPhone: (phone: string) => void;
  /** Step 1: request an OTP for this phone. Returns true on success. */
  requestOtp: (phone: string) => Promise<boolean>;
  /** Step 2: verify the code → sign in. Returns true on success. (Mock: any 4 digits.) */
  verifyOtp: (code: string) => Promise<boolean>;
  /** Restore a saved session from SecureStore on app start (backend mode only). */
  restoreSession: () => Promise<void>;
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
  // In backend mode we briefly try to restore a session before routing.
  isHydrating: USE_BACKEND,

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
      await request('/api/auth/login', { method: 'POST', body: { phone }, skipAuth: true });
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
      const data = await request<VerifyResponse>('/api/auth/verify', {
        method: 'POST',
        body: { phone, code },
        skipAuth: true,
      });
      setAccessToken(data.accessToken);
      await saveRefreshToken(data.refreshToken);
      set({
        user: mapCustomer(data.customer),
        token: data.accessToken,
        isAuthenticated: true,
        isGuest: false,
      });
      return true;
    } catch {
      return false;
    }
  },

  restoreSession: async () => {
    if (!USE_BACKEND) {
      set({ isHydrating: false });
      return;
    }
    try {
      const refreshToken = await loadRefreshToken();
      if (!refreshToken) {
        set({ isHydrating: false });
        return;
      }
      // Mint a fresh access token from the stored refresh token, then load the profile.
      const ok = await refreshAccessToken();
      if (!ok) {
        set({ isHydrating: false });
        return;
      }
      const customer = await request<CustomerDTO>('/api/auth/me');
      set({
        user: mapCustomer(customer),
        token: getAccessToken(),
        isAuthenticated: true,
        isGuest: false,
        isHydrating: false,
      });
    } catch {
      set({ isHydrating: false });
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

  logout: () => {
    // Best-effort server revoke + clear the keychain (backend mode), then reset state.
    if (USE_BACKEND) {
      request('/api/auth/logout', { method: 'POST' }).catch(() => {});
      void clearSession();
    }
    set({ user: null, token: null, isAuthenticated: false, isGuest: false, pendingPhone: '' });
  },
}));

// Wire the "session expired" callback used by the API client. In backend mode a
// failed token refresh clears auth state and sends the user to login (cart and
// other local state are preserved so they can continue after re-login).
registerSessionHandlers({
  onExpired: () => {
    useAuthStore.setState({ user: null, token: null, isAuthenticated: false });
    if (USE_BACKEND) router.replace('/(auth)/login');
  },
});
