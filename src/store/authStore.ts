import { create } from 'zustand';
import { router } from 'expo-router';
import type { User } from '@/types';
import { mockUser } from '@/data';
import { setLocale, type LocaleCode } from '@/i18n';
import { USE_BACKEND } from '@/services/api';
import { clearSession, registerSessionHandlers } from '@/services/session';
import * as storeAuth from '@/services/storeAuth';
import { auth as firebaseAuth } from '@/services/firebase';
import type { User as FbUser } from '@firebase/auth';

/**
 * Build the app's `User` from a Firebase account.
 *
 * The store keeps no profile document — a customer is a phone number, and the
 * display name is carried on their orders (`customer_name_sync`). So the fields
 * this app shows beyond phone (email, city, gender, birthday) simply have no
 * source yet; they stay undefined rather than being invented. The name falls
 * back to the phone's last digits so the avatar is never blank.
 */
function userFromFirebase(fb: FbUser | null, fallbackPhone: string): User {
  // Firebase stores E.164 (+9665…); every screen in this app formats the local
  // 5XXXXXXXX form.
  const e164 = fb?.phoneNumber ?? '';
  const local = e164.replace(/^\+?966/, '') || fallbackPhone || '';
  const name = fb?.displayName?.trim() || `عميل ${local.slice(-4)}`;
  return {
    id: fb?.uid ?? local,
    name,
    phone: local,
    avatarText: name.charAt(0) || 'ع',
    joinedAt: fb?.metadata?.creationTime ? Date.parse(fb.metadata.creationTime) : Date.now(),
  };
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
  /**
   * Arabic text for the last sign-in refusal, or null.
   *
   * The OTP path fails in ways the customer must be able to tell apart —
   * a wrong code, an expired one, and a lockout after five wrong attempts all
   * need different next actions. A single boolean cannot carry that.
   */
  authError: string | null;

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
  authError: null,

  setLocale: (locale) => {
    setLocale(locale);
    set({ locale });
  },
  completeOnboarding: () => set({ hasOnboarded: true }),
  setPendingPhone: (phone) => set({ pendingPhone: phone }),

  requestOtp: async (phone) => {
    set({ pendingPhone: phone, authError: null });
    if (!USE_BACKEND) return true; // mock: nothing to send
    const res = await storeAuth.requestOtp(phone);
    if (!res.ok) set({ authError: storeAuth.describeOtpError(res.reason) });
    return res.ok;
  },

  verifyOtp: async (code) => {
    const phone = get().pendingPhone || mockUser.phone;
    if (!USE_BACKEND) {
      // Mock sign-in (unchanged behavior).
      set({ user: { ...mockUser, phone }, token: 'mock-token', isAuthenticated: true, isGuest: false });
      return true;
    }
    const res = await storeAuth.verifyOtp(phone, code);
    if (!res.ok) {
      // The reason matters here. "5 wrong attempts" destroys the code, and a
      // customer told only "wrong code" will keep typing into a dead prompt.
      set({ authError: storeAuth.describeOtpError(res.reason) });
      return false;
    }
    const fbUser = firebaseAuth().currentUser;
    set({
      user: userFromFirebase(fbUser, phone),
      token: fbUser?.uid ?? null,
      isAuthenticated: true,
      isGuest: false,
      authError: null,
    });
    return true;
  },

  restoreSession: async () => {
    if (!USE_BACKEND) {
      set({ isHydrating: false });
      return;
    }
    /**
     * Firebase persists the session itself (AsyncStorage), so there is no token
     * to refresh by hand — but `currentUser` is null for a moment after launch
     * while that read completes. Routing off that null flashes the login screen
     * at a customer who is already signed in, so we wait for the first real
     * auth state instead of reading the property.
     */
    try {
      const fbUser = await storeAuth.waitForAuthReady();
      if (!fbUser) {
        set({ isHydrating: false });
        return;
      }
      set({
        user: userFromFirebase(fbUser, get().pendingPhone),
        token: fbUser.uid,
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
    if (USE_BACKEND) {
      void storeAuth.signOutStore();
      // Clears anything the previous Express-backed session left behind.
      void clearSession();
    }
    set({
      user: null,
      token: null,
      isAuthenticated: false,
      isGuest: false,
      pendingPhone: '',
      authError: null,
    });
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
