import type { LegalDocId } from '@/data/legal';

/**
 * Public legal pages — the URLs entered in App Store Connect and Play Console.
 *
 * They are sunray.sa's own pages, which cover every Sun Ray service including
 * this app. They used to be served by Caddy on the VPS; that host is being
 * switched off, and every link pointing at it would have died with it.
 *
 * Inside the app the documents are shown natively (`app/legal/[doc]`), from
 * `data/legal.ts`. Keep the two saying the same thing.
 */
const SITE = 'https://sunray.sa';

export const PRIVACY_URL = `${SITE}/privacy`;
export const TERMS_URL = `${SITE}/terms`;
/** Registered in Play Console as the account-deletion URL. */
export const DELETE_ACCOUNT_URL = `${SITE}/data-deletion`;

/** The public copy of each in-app document. The refund policy is a section of the terms there. */
export const LEGAL_WEB_URLS: Record<LegalDocId, string> = {
  privacy: PRIVACY_URL,
  terms: TERMS_URL,
  refunds: TERMS_URL,
};
