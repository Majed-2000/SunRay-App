/**
 * Types for the vendored Saudi plate module.
 *
 * `plate_core.js` is a generated artefact copied verbatim from the store repo,
 * so it carries no types of its own and must not be edited to add any. This
 * declaration sits beside it instead, describing only what this app uses.
 */

/** Arabic → Latin, the official 17-letter plate mapping. */
export const PLATE_MAP: Readonly<Record<string, string>>;

/** The 17 letters in Arabic alphabet order — the order a keypad should show. */
export const PLATE_LETTERS_AR: readonly string[];

/** Letters that never appear on Saudi plates. */
export const BANNED_AR: readonly string[];

export const MAX_LETTERS: number;
export const MAX_NUMBERS: number;
export const PLATE_MAPPING_VERSION: number;

/**
 * Clean up Arabic plate letters.
 *
 * Silently corrects near-certain typos (ة → ه, ي → ى) before validating, so a
 * customer typing the wrong-but-obvious character is not stopped.
 */
export function normalizeArabicPlate(input: string): string;

/** Clean up the digits, converting Arabic-Indic numerals to Latin. */
export function normalizePlateNumbers(input: string): string;

/** Refusal. `message` is ready-to-show Arabic and names the offending character. */
export interface PlateInvalid {
  ok: false;
  /** e.g. `letters_unknown_char`, `numbers_too_many`. */
  code: string;
  /** Which input to point the customer at: `letters` or `numbers`. */
  field: 'letters' | 'numbers';
  message: string;
  /** Present on `letters_unknown_char`. */
  char?: string;
}

export interface PlateValid {
  ok: true;
  plateType: string;
  lettersAr: string;
  /** Exactly as entered — never zero-padded. */
  numbers: string;
  /** Latin transliteration, as printed on the slip at the counter. */
  lettersEn: string;
  plate: string;
  mappingVersion: number;
}

export type PlateValidation = PlateValid | PlateInvalid;

/** Validate letters and numbers together. The server validates again. */
export function validatePlate(lettersAr: string, numbers: string): PlateValidation;

/** Arabic letters → their Latin plate equivalents. */
export function transliterate(lettersAr: string): string;
