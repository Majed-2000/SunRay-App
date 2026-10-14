/**
 * The catering requests and tickets this device created — remembered locally.
 *
 * ## Why keys live on the device
 *
 * `sunray/catering` and `sunray/tickets` can be read whole by anyone today.
 * That is a bug in the rules, not an API, and the website leans on it (it
 * scans every catering record, and finds tickets with `orderByChild("code")`).
 * The day the rules are fixed those patterns stop working.
 *
 * So the app never lists those nodes. It keeps the push key of each record it
 * wrote, and reads exactly `sunray/<node>/<key>` — the one read that will keep
 * working under owner-only rules. A ticket made elsewhere is found through
 * `sunray/shortIndex/ticket/<code>` (a single key) and then remembered too.
 *
 * Entries carry the uid that created them so a second account signed in on the
 * same phone does not see the first one's event address or complaint.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

export type RequestKind = 'catering' | 'ticket';

export interface MyRequest {
  key: string;
  code: string;
  /** Firebase uid that created or claimed it; null if signed out at the time. */
  uid: string | null;
  at: number;
}

const STORAGE_KEY: Record<RequestKind, string> = {
  catering: 'sunray.myCatering.v1',
  ticket: 'sunray.myTickets.v1',
};

/** RTDB push keys are 20 chars of [-_A-Za-z0-9]; anything else is not ours. */
const PUSH_KEY = /^[-_A-Za-z0-9]{10,40}$/;

async function readAll(kind: RequestKind): Promise<MyRequest[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY[kind]);
    const arr = raw ? (JSON.parse(raw) as MyRequest[]) : [];
    return Array.isArray(arr) ? arr.filter((r) => r && typeof r.key === 'string' && PUSH_KEY.test(r.key)) : [];
  } catch {
    // Corrupt storage must not take the screen down; the records still exist
    // server-side and the customer can look a ticket up by its code.
    return [];
  }
}

/** This account's remembered records, newest first. */
export async function listMyRequests(kind: RequestKind, uid: string | null): Promise<MyRequest[]> {
  const all = await readAll(kind);
  return all.filter((r) => r.uid === uid).sort((a, b) => b.at - a.at);
}

export async function rememberRequest(kind: RequestKind, entry: Omit<MyRequest, 'at'>): Promise<void> {
  if (!PUSH_KEY.test(entry.key)) return;
  const all = await readAll(kind);
  const next = [{ ...entry, at: Date.now() }, ...all.filter((r) => !(r.key === entry.key && r.uid === entry.uid))];
  // A cap, so years of tickets do not turn into a slow screen.
  await AsyncStorage.setItem(STORAGE_KEY[kind], JSON.stringify(next.slice(0, 50)));
}

/** Drop a record that no longer exists server-side (deleted by staff). */
export async function forgetRequest(kind: RequestKind, key: string): Promise<void> {
  const all = await readAll(kind);
  await AsyncStorage.setItem(STORAGE_KEY[kind], JSON.stringify(all.filter((r) => r.key !== key)));
}
