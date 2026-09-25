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
import { router } from 'expo-router';
import { useLoyaltyStore } from './loyaltyStore';

/** «عميل ١٢٣٤» — shown when the account has no name yet. Never saved as one. */
function placeholderName(local: string): string {
  return `عميل ${local.slice(-4)}`.trim();
}

/**
 * True when `user.name` is a name the customer gave, not the phone-digit
 * stand-in. Edit Profile pre-filled the stand-in into the name field, so a
 * customer who tapped «حفظ» saved «عميل 1234» to their account as their name.
 */
export function hasRealName(user: User | null): boolean {
  return !!user && !!user.name.trim() && user.name !== placeholderName(user.phone);
}

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
  const name = fb?.displayName?.trim() || placeholderName(local);
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
  /**
   * The phone this device last verified, and for which account.
   *
   * Sign-in is by custom token, so the Firebase account may carry no
   * `phoneNumber`. The OTP step knows the phone, but only in memory — after a
   * restart a signed-in customer came back with no phone at all and the
   * Account screen called them «زائر». Keyed by uid so it never lends one
   * customer's number to another.
   */
  verifiedPhone: { uid: string; phone: string } | null;

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
  verifiedPhone: null,

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
      verifiedPhone: fbUser && phone ? { uid: fbUser.uid, phone } : null,
    });
    watchAuth();
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
      watchAuth();
      if (!fbUser) {
        set({ isHydrating: false });
        return;
      }
      set({
        user: userFromFirebase(fbUser, phoneFor(fbUser.uid)),
        token: fbUser.uid,
        isAuthenticated: true,
        isGuest: false,
        isHydrating: false,
      });
      /**
       * The user Firebase restores is the copy it saved on this device, so a
       * name set on the web store, by the café or on another phone never
       * arrived here. Re-read the account — after routing, not before it: a
       * slow network must not hold the splash screen.
       */
      void fbUser
        .reload()
        .then(() => {
          const fresh = firebaseAuth().currentUser;
          const s = get();
          if (!fresh || fresh.uid !== fbUser.uid || !s.isAuthenticated || s.isGuest) return;
          const next = userFromFirebase(fresh, phoneFor(fresh.uid));
          if (s.user && next.name === s.user.name && next.phone === s.user.phone) return;
          set({ user: s.user ? { ...next, birthMonth: s.user.birthMonth } : next });
        })
        // Offline: the saved copy stands. A revoked account is signed out by
        // Firebase, and the auth listener below takes it from there.
        .catch(() => {});
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
    // Each part is applied as soon as the server has it. They used to be
    // applied together only if both succeeded — so a refused birth month left
    // Home showing the old name while Firebase already held the new one.
    if (trimmed && trimmed !== current.name) {
      if (await storeAuth.saveDisplayName(trimmed)) {
        const u = get().user ?? current;
        set({ user: { ...u, name: trimmed, avatarText: trimmed.charAt(0) || u.avatarText } });
      } else {
        ok = false;
      }
    }
    // Compared with what the ledger holds. `current.birthMonth` is empty after
    // every restart, so the month was re-sent on every save, even a name-only
    // one — and a refusal then reported the whole save as failed.
    const savedMonth = useLoyaltyStore.getState().data?.birthMonth ?? current.birthMonth;
    if (birthMonth !== undefined && birthMonth !== savedMonth) {
      if (await setBirthMonth(birthMonth)) {
        const u = get().user ?? current;
        set({ user: { ...u, birthMonth } });
        // The ledger is where Edit Profile reads the month back from.
        void useLoyaltyStore.getState().load();
      } else {
        ok = false;
      }
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
      verifiedPhone: null,
    });
    // The balance on Home and Account is this customer's; the next person to
    // sign in (or a guest) must not open onto it.
    useLoyaltyStore.getState().reset();
  },
  }),
  {
    name: 'sunray.auth',
    version: PERSIST_VERSION,
    storage: deviceStorage,
    // The signed-in user comes from Firebase's own persisted session; keeping
    // a copy here would show a profile after sign-out. `verifiedPhone` is only
    // a fallback for that account's own phone and is cleared on logout.
    partialize: (s) => ({ hasOnboarded: s.hasOnboarded, verifiedPhone: s.verifiedPhone }),
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

/** The phone this device verified for `uid`, or '' for any other account. */
function phoneFor(uid: string): string {
  const v = useAuthStore.getState().verifiedPhone;
  return v && v.uid === uid ? v.phone : '';
}

/**
 * Follow Firebase's sign-in state for the life of the app.
 *
 * The session was read once at launch and never again. When Firebase later
 * dropped it — the account deleted from the web store, which revokes every
 * session, or a refresh token that stopped working — the app stayed "signed
 * in" while every call came back unauthenticated, with no way back to login.
 */
let stopWatching: (() => void) | null = null;
function watchAuth() {
  if (stopWatching) return;
  stopWatching = storeAuth.onAuthChanged((fb) => {
    const s = useAuthStore.getState();
    // Our own logout clears the state before Firebase reports the sign-out,
    // so this only acts on a sign-out that came from somewhere else.
    if (!s.isAuthenticated || s.isGuest) return;
    if (!fb) {
      s.logout();
      router.replace('/(auth)/login');
      return;
    }
    if (s.user?.id !== fb.uid) {
      useAuthStore.setState({ user: userFromFirebase(fb, phoneFor(fb.uid)), token: fb.uid });
    }
  });
}
