/**
 * Customer sign-in against the live store: OTP by SMS, then a Firebase session.
 *
 * The store does not use Firebase Phone Auth. It sends the code itself through
 * Yamamah — the same provider this app was already wired to — and on a correct
 * code mints a Firebase **custom token** for the uid that owns that phone. So
 * the customer keeps one identity across the web store and the app, and their
 * orders and loyalty balance follow them.
 *
 * The code never travels to the client: the server stores only an HMAC of it
 * (`functions/store_otp.js`) and compares in constant time.
 *
 * ## Limits worth designing around, not discovering
 *
 * Losing Firebase's reCAPTCHA means every send costs real money, so the server
 * rate-limits hard, and each limit surfaces as a distinct `reason`:
 *
 *   60s between sends · 5 per hour · 10 per day
 *   5 wrong attempts → the code is destroyed and the customer must resend
 *   codes expire after 5 minutes, single use
 *
 * A customer who is locked out and told only "wrong code" will keep typing.
 * `describeOtpError` maps each reason to what actually happened.
 */
import { signInWithCustomToken, signOut, onAuthStateChanged, type User as FbUser } from 'firebase/auth';
import { auth, callFn, type CallResult } from './firebase';

/** `requestStoreOtp` reply. Times are echoed so the UI can match the server. */
export interface RequestOtpResult extends CallResult {
  cooldownSec?: number;
  expiresInSec?: number;
}

interface VerifyOtpResult extends CallResult {
  /** Firebase custom token — present only when `ok`. */
  token?: string;
}

/**
 * Saudi mobile in the shape the server normalizes to: `9665XXXXXXXX`.
 *
 * The server normalizes again and rejects anything that is not a Saudi mobile,
 * so this is a courtesy not a gate — but sending a shape it will reject wastes
 * a round trip and, worse, can burn one of the day's ten sends.
 */
export function toStorePhone(local: string): string {
  const digits = String(local ?? '')
    // Arabic-Indic digits arrive from phone keypads.
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/\D/g, '');
  if (digits.startsWith('966')) return digits;
  if (digits.startsWith('0')) return `966${digits.slice(1)}`;
  return `966${digits}`;
}

/** Step 1 — ask the server to text a code. */
export async function requestOtp(localPhone: string): Promise<RequestOtpResult> {
  try {
    return await callFn<RequestOtpResult>('requestStoreOtp', { phone: toStorePhone(localPhone) });
  } catch (e) {
    return { ok: false, reason: firebaseErrorReason(e) };
  }
}

/**
 * Step 2 — verify the code and open a Firebase session.
 *
 * Signing in is part of verifying, not a step after it: a caller that got
 * `{ ok: true }` and forgot to redeem the token would believe the customer was
 * signed in while every later call went out unauthenticated.
 */
export async function verifyOtp(localPhone: string, code: string): Promise<CallResult> {
  let res: VerifyOtpResult;
  try {
    res = await callFn<VerifyOtpResult>('verifyStoreOtp', {
      phone: toStorePhone(localPhone),
      code: String(code ?? '').trim(),
    });
  } catch (e) {
    return { ok: false, reason: firebaseErrorReason(e) };
  }
  if (!res.ok || !res.token) return { ok: false, reason: res.reason || 'wrong' };

  try {
    await signInWithCustomToken(auth(), res.token);
    return { ok: true };
  } catch (e) {
    // The code WAS correct; the session failed to open. Saying "wrong code"
    // here would send the customer back to re-enter a code that already worked.
    return { ok: false, reason: firebaseErrorReason(e) || 'session' };
  }
}

export async function signOutStore(): Promise<void> {
  try {
    await signOut(auth());
  } catch {
    // Already signed out, or offline. Either way the local session is gone.
  }
}

/**
 * Resolve once Firebase has restored (or failed to restore) a saved session.
 *
 * `auth().currentUser` is null immediately after launch even when a valid
 * session exists on disk, because reading AsyncStorage is async. Routing off
 * that null flashes the login screen at a signed-in customer.
 */
export function waitForAuthReady(): Promise<FbUser | null> {
  return new Promise((resolve) => {
    const stop = onAuthStateChanged(auth(), (user) => {
      stop();
      resolve(user);
    });
  });
}

/** Subscribe to sign-in/sign-out for the lifetime of the app. */
export function onAuthChanged(cb: (user: FbUser | null) => void): () => void {
  return onAuthStateChanged(auth(), cb);
}

/** Extract a usable reason from a thrown Firebase/HttpsError. */
function firebaseErrorReason(e: unknown): string {
  const code = (e as { code?: string })?.code;
  if (!code) return 'network';
  // "functions/resource-exhausted" → "resource-exhausted"
  return code.includes('/') ? code.split('/')[1] : code;
}

/** Arabic text for every refusal the OTP path can return. */
export function describeOtpError(reason?: string): string {
  switch (reason) {
    case 'wrong':
      return 'الرمز غير صحيح';
    case 'expired':
      return 'انتهت صلاحية الرمز، اطلب رمزًا جديدًا';
    case 'locked':
      return 'حاولت كثيرًا. اطلب رمزًا جديدًا للمتابعة';
    case 'cooldown':
    case 'resource-exhausted':
      return 'انتظر قليلًا قبل طلب رمز جديد';
    case 'invalid-argument':
    case 'bad_phone':
      return 'رقم الجوال غير صحيح';
    case 'session':
      return 'تعذّر فتح الجلسة، حاول مرة أخرى';
    case 'network':
    case 'unavailable':
      return 'تعذّر الاتصال، تحقّق من الإنترنت';
    default:
      return 'تعذّر التحقق، حاول مرة أخرى';
  }
}

/**
 * Permanently delete the customer's account.
 *
 * The store owns this: it anonymises the phone (`deleted:` prefix), keeps the
 * orders for accounting, and revokes the sessions. Doing it locally would leave
 * the ledger and the order history pointing at a customer who believes they are
 * gone.
 */
export async function deleteStoreAccount(): Promise<CallResult> {
  try {
    const res = await callFn<CallResult>('deleteStoreAccount');
    if (res?.ok === false) return res;
    await signOutStore();
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: firebaseErrorReason(e) };
  }
}
