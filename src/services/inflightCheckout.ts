/**
 * The order checkout is collecting a card for, kept on the device.
 *
 * `orderStore.checkout` alone lives in memory, so closing the app mid-payment
 * lost it while the cart stayed saved — and «تأكيد الطلب» then created a second
 * order for the same cart. This is the minimum needed to find the first one
 * again: ids and a timestamp, nothing secret.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { InflightCheckoutRecord } from '@/utils/inflightCheckout';

const KEY = 'sunray.inflightCheckout';

export async function saveInflight(record: InflightCheckoutRecord): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(record));
  } catch {
    /* best effort — the in-memory copy still works for this session */
  }
}

export async function loadInflight(): Promise<InflightCheckoutRecord | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return null;
    const rec = JSON.parse(raw) as InflightCheckoutRecord;
    if (!rec?.order?.orderId || typeof rec.cartKey !== 'string' || typeof rec.at !== 'number') return null;
    return rec;
  } catch {
    return null;
  }
}

export async function clearInflight(): Promise<void> {
  try {
    await AsyncStorage.removeItem(KEY);
  } catch {
    /* nothing useful to do */
  }
}
