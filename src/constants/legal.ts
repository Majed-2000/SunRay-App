/**
 * Public legal pages. Both stores record these URLs, so they must stay live.
 *
 * Today they are served by Caddy on the VPS (`EXPO_PUBLIC_API_BASE_URL`), the
 * only thing that host still does for the app. When the pages move to Firebase
 * Hosting on a permanent domain, change the base here and in `eas.json`.
 */
const LEGAL_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? '';

export const PRIVACY_URL = `${LEGAL_BASE_URL}/privacy`;
export const TERMS_URL = `${LEGAL_BASE_URL}/terms`;
/** Registered in Play Console as the account-deletion URL. */
export const DELETE_ACCOUNT_URL = `${LEGAL_BASE_URL}/delete-account`;
