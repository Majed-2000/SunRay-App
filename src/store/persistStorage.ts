import AsyncStorage from '@react-native-async-storage/async-storage';
import { createJSONStorage } from 'zustand/middleware';

/**
 * Device storage for the few things that must survive closing the app.
 *
 * Nothing here is a secret or a source of truth: the session is Firebase's,
 * and prices, points and orders are always re-read from the server. What is
 * kept is what the customer would otherwise lose for no reason — a half-built
 * cart, and having already seen onboarding.
 */
export const deviceStorage = createJSONStorage(() => AsyncStorage);

/** Bump when a persisted shape changes; older data is then discarded. */
export const PERSIST_VERSION = 1;
