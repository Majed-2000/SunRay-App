/**
 * Firebase — the app's connection to the live Sun Ray store backend.
 *
 * The app used to talk to our own Express/Postgres server, which reimplemented
 * what the store already does. That split the truth in two: most dangerously
 * the loyalty ledger, where one customer phone would have had two balances and
 * a reward could be spent twice. Everything the store owns — orders, catalog,
 * loyalty, Moyasar, Foodics — now comes from here, so the app and the admin
 * dashboard are looking at the same row.
 *
 * ## The config below is public, and that is fine
 *
 * A Firebase web `apiKey` is a project identifier, not a credential: it names
 * which project a request is for and grants nothing on its own. Access is
 * decided by the Realtime Database rules and by each callable function's own
 * auth checks. The real secrets — the Moyasar secret key, the OTP HMAC secret,
 * the webhook secret — live in `functions/.env` on the server and never travel
 * to a device.
 *
 * ## Region
 *
 * Every callable is deployed to `europe-west1`. Calling with the default region
 * fails with a bare "not-found" that reads like a missing function rather than
 * a misrouted call, so the region is pinned here once.
 */
/**
 * ⚠️ `@firebase/app` and `@firebase/auth`, NOT `firebase/app` and
 * `firebase/auth`.
 *
 * The umbrella `firebase` package declares no `react-native` export condition
 * on ANY subpath — only `node`, `browser` and `default`. Metro therefore
 * resolves `firebase/auth` to the **browser** build, which does not contain
 * `getReactNativePersistence` at all. The import silently becomes `undefined`,
 * calling it throws, and the browser build then reaches for `indexedDB` on a
 * device that has none: the app renders its splash and dies.
 *
 * The inner `@firebase/auth` package DOES declare `react-native`, so importing
 * it directly gets the build meant for this platform.
 *
 * `database` and `functions` stay on the umbrella deliberately — neither inner
 * package declares a react-native condition either, because both are
 * isomorphic and the default build is the correct one on a device.
 *
 * 🔍 How this was missed: the built bundle was searched for the string
 * "getReactNativePersistence" and it was there — but it was there because THIS
 * FILE names it. Finding an identifier you wrote proves nothing about what the
 * dependency exported. The check that actually settles it is reading the two
 * dist files: the browser build has no such symbol, the RN build does.
 */
import { initializeApp, getApps, getApp, type FirebaseApp } from '@firebase/app';
import {
  initializeAuth,
  getAuth,
  getReactNativePersistence,
  type Auth,
} from '@firebase/auth';
import { getDatabase, type Database } from 'firebase/database';
import { getFunctions, httpsCallable, type Functions } from 'firebase/functions';
import AsyncStorage from '@react-native-async-storage/async-storage';

/** Callable functions region. Must match `functions/index.js`. */
export const FUNCTIONS_REGION = 'europe-west1';

const firebaseConfig = {
  apiKey: 'AIzaSyBBRE2F1KR09pZb8CtcBdcqAi7gZLlLE9Y',
  authDomain: 'sunray-xx.firebaseapp.com',
  databaseURL: 'https://sunray-xx-default-rtdb.europe-west1.firebasedatabase.app',
  projectId: 'sunray-xx',
  storageBucket: 'sunray-xx.firebasestorage.app',
  messagingSenderId: '195057560005',
  appId: '1:195057560005:web:7ef9ba97e6bb6920c543ac',
};

let _app: FirebaseApp | null = null;
let _auth: Auth | null = null;
let _db: Database | null = null;
let _fns: Functions | null = null;

export function app(): FirebaseApp {
  if (_app) return _app;
  // Fast Refresh re-runs module bodies; initializeApp throws on a duplicate.
  _app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  return _app;
}

export function auth(): Auth {
  if (_auth) return _auth;
  /**
   * React Native has no browser storage, so without an explicit persistence
   * the session lives in memory only and the customer is signed out every cold
   * start. `initializeAuth` must run before any `getAuth`, and throws if called
   * twice — hence the try/catch fallback rather than a getApps()-style check,
   * which does not cover an Auth instance created elsewhere first.
   */
  try {
    _auth = initializeAuth(app(), {
      persistence: getReactNativePersistence(AsyncStorage),
    });
  } catch {
    _auth = getAuth(app());
  }
  return _auth;
}

export function db(): Database {
  if (_db) return _db;
  _db = getDatabase(app());
  return _db;
}

export function fns(): Functions {
  if (_fns) return _fns;
  _fns = getFunctions(app(), FUNCTIONS_REGION);
  return _fns;
}

/**
 * Call a callable function and return its payload.
 *
 * These functions answer in two different shapes and both must be handled:
 * they either throw an `HttpsError` (unauthenticated, permission-denied,
 * failed-precondition) or resolve with `{ ok: false, reason }` for expected
 * refusals like a wrong OTP. Treating only the throw as failure would let
 * `{ ok: false }` sail through as success — the caller would report a code
 * accepted when it was rejected. Callers get the raw payload and check `ok`.
 */
export async function callFn<T = unknown>(name: string, data?: unknown): Promise<T> {
  const fn = httpsCallable(fns(), name);
  const res = await fn(data ?? {});
  return res.data as T;
}

/** Shape shared by most store callables. */
export interface CallResult {
  ok: boolean;
  reason?: string;
}
