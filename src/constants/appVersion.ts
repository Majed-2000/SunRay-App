import Constants from 'expo-constants';
import { toArabicDigits } from '@/utils/numerals';

/**
 * The version the customer is running, read from the build (`app.json`).
 *
 * Two screens used to print «١.٠.٠» as literal text while the app shipped as
 * 1.2.x — useless to support staff asking which version a customer has.
 */
export const APP_VERSION: string = Constants.expoConfig?.version ?? '';

/** Version in Arabic-Indic digits, for display. */
export const APP_VERSION_AR = toArabicDigits(APP_VERSION);
