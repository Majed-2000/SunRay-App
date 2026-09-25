import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { deviceStorage, PERSIST_VERSION } from './persistStorage';
import type { User } from '@/types';
import { setLocale, type LocaleCode } from '@/i18n';
import * as SecureStore from 'expo-secure-store';
import * as storeAuth from '@/services/storeAuth';
import { setBirthMonth } from '@/services/storeLoyalty';
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
  /** Wait for Firebase to restore a persisted sign-in on app start. */
  restoreSession: () => Promise<void>;
  continueAsGuest: () => void;
  /**
   * Save the name (on the Firebase account) and birth month (on the server).
   * Resolves false if either failed; nothing is shown as saved until it is.
   */
  saveProfile: (patch: { name?: string; birthMonth?: number }) => Promise<boolean>;
  logout: () => void;
}

/** Keychain key the Express-era session client stored its refresh token under. */
const LEGACY_REFRESH_KEY = 'sunray.refreshToken';

export const useAuthStore = create<AuthState>()(
  persist(
  (set, get) => ({
  user: null,
  token: null,
  isAuthenticated: false,
  isGuest: false,
  hasOnboarded: false,
  locale: 'ar',
  pendingPhone: '',
  // Firebase restores a persisted sign-in asynchronously; routing waits for it.
  isHydrating: true,
  authError: null,

  setLocale: (locale) => {
    setLocale(locale);
    set({ locale });
  },
  completeOnboarding: () => set({ hasOnboarded: true }),
  setPendingPhone: (phone) => set({ pendingPhone: phone }),

  requestOtp: async (phone) => {
    set({ pendingPhone: phone, authError: null });
    const res = await storeAuth.requestOtp(phone);
    if (!res.ok) set({ authError: storeAuth.describeOtpError(res.reason) });
    return res.ok;
  },

  verifyOtp: async (code) => {
    const phone = get().pendingPhone;
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
    /**
     * Firebase persists the session itself (AsyncStorage), so there is no token
     * to refresh by hand — but `currentUser` is null for a moment after launch
     * while that read completes. Routing off that null flashes the login screen
     * at a customer who is already signed in, so we wait for the first real
     * auth state instead of reading the property.
     */
    try {
      // Routing also reads `hasOnboarded` from device storage; don't let the
      // splash decide before that has loaded.
      await waitForPersist();
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
      // Nothing borrowed from the demo profile: a guest used to carry its phone
      // (501234567) and email, and screens showed them as the guest's own.
      user: { id: 'guest', name: 'ضيف', phone: '', avatarText: 'ض', joinedAt: Date.now() },
      token: null,
      isAuthenticated: true,
      isGuest: true,
    }),

  /**
   * This used to write into memory and say «تم تحديث ملفك» — gone on the next
   * launch, and the birth month never reached the server, so the birthday
   * reward it promised could not happen.
   */
  saveProfile: async ({ name, birthMonth }) => {
    const current = get().user;
    if (!current || get().isGuest) return false;
    let ok = true;
    const trimmed = name?.trim();
    if (trimmed !== undefined && trimmed !== current.name) {
      ok = (await storeAuth.saveDisplayName(trimmed)) && ok;
    }
    if (birthMonth !== undefined && birthMonth !== current.birthMonth) {
      ok = (await setBirthMonth(birthMonth)) && ok;
    }
    if (ok) {
      set({
        user: {
          ...current,
          ...(trimmed ? { name: trimmed, avatarText: trimmed.charAt(0) || current.avatarText } : {}),
          ...(birthMonth !== undefined ? { birthMonth } : {}),
        },
      });
    }
    return ok;
  },

  logout: () => {
    void storeAuth.signOutStore();
    // A refresh token for the retired Express server may still sit in the
    // keychain from builds before 1.2.0. It is a credential; don't leave it.
    void SecureStore.deleteItemAsync(LEGACY_REFRESH_KEY).catch(() => {});
    set({
      user: null,
      token: null,
      isAuthenticated: false,
      isGuest: false,
      pendingPhone: '',
      authError: null,
    });
  },
  }),
  {
    name: 'sunray.auth',
    version: PERSIST_VERSION,
    storage: deviceStorage,
    // Only this. The signed-in user comes from Firebase's own persisted
    // session; keeping a copy here would show a profile after sign-out.
    partialize: (s) => ({ hasOnboarded: s.hasOnboarded }),
  },
  ),
);

/** Resolves once the persisted slice has been read from device storage. */
function waitForPersist(): Promise<void> {
  if (useAuthStore.persist.hasHydrated()) return Promise.resolve();
  return new Promise((resolve) => {
    const stop = useAuthStore.persist.onFinishHydration(() => {
      stop();
      resolve();
    });
  });
}

