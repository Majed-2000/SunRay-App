/**
 * Support tickets — «الدعم الفني» on sunray.sa.
 *
 * There is no callable for this: tickets.js pushes the record straight into
 * `sunray/tickets` and staff answer from the dashboard by writing `status`
 * and `adminReply` on the same record. The app writes the identical shape
 * (see `buildTicketRecord`) so a ticket from the phone is indistinguishable on
 * the dashboard from one sent on the website.
 *
 * Reads are by key only — see `myRequests.ts` for why the collection is never
 * listed or queried.
 */
import { get, onValue, off, push, ref, serverTimestamp, set, type DataSnapshot } from 'firebase/database';
import { auth, db } from './firebase';
import { buildTicketRecord, genCode, type TicketInput, type TicketRecord } from './requestRules';
import { forgetRequest, rememberRequest } from './myRequests';

export interface CreatedTicket {
  key: string;
  code: string;
}

/**
 * Push a new ticket and its `shortIndex` entry, then remember the key.
 *
 * The index write is best-effort, as on the site: if it fails the ticket still
 * exists and staff still see it; only lookup-by-code on another device is lost.
 */
export async function createTicket(input: TicketInput): Promise<CreatedTicket> {
  const code = genCode('TK');
  const r = push(ref(db(), 'sunray/tickets'));
  const key = r.key as string;
  await set(r, buildTicketRecord(input, code, serverTimestamp()));
  await set(ref(db(), `sunray/shortIndex/ticket/${code}`), key).catch(() => {});
  await rememberRequest('ticket', { key, code, uid: auth().currentUser?.uid ?? null });
  return { key, code };
}

/** Live view of one ticket. `null` means it no longer exists. */
export function subscribeTicket(
  key: string,
  cb: (t: TicketRecord | null) => void,
  onError?: (e: Error) => void,
): () => void {
  const r = ref(db(), `sunray/tickets/${key}`);
  const handler = (snap: DataSnapshot) => {
    const v = snap.val() as TicketRecord | null;
    // Staff can delete a ticket; stop showing it in «تذاكري».
    if (!v) void forgetRequest('ticket', key);
    cb(v);
  };
  onValue(r, handler, (e) => onError?.(e));
  return () => off(r, 'value', handler);
}

export async function readTicket(key: string): Promise<TicketRecord | null> {
  const snap = await get(ref(db(), `sunray/tickets/${key}`));
  return (snap.val() as TicketRecord | null) ?? null;
}

/**
 * Find an older ticket by its `TK-####` code through the one-key index —
 * `sunray/shortIndex/ticket/<code>` holds the push key as a plain string —
 * and remember it so it shows in «تذاكري» from now on.
 */
export async function lookupTicketByCode(code: string): Promise<{ key: string; ticket: TicketRecord } | null> {
  const idx = await get(ref(db(), `sunray/shortIndex/ticket/${code}`));
  const key = idx.val();
  if (typeof key !== 'string' || !key) return null;
  const ticket = await readTicket(key);
  if (!ticket) return null;
  await rememberRequest('ticket', { key, code: ticket.code ?? code, uid: auth().currentUser?.uid ?? null });
  return { key, ticket };
}
