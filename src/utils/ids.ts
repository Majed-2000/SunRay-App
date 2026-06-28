/**
 * Deterministic UUID-like id generator for MOCK data only. Produces a stable
 * "Foodics-like" id from a seed string (no randomness, so mock data is stable
 * across reloads). Real ids come from Foodics via our backend.
 */
export function foodicsId(seed: string): string {
  const bytes: number[] = [];
  let h = 0x811c9dc5; // FNV-1a offset basis
  for (let i = 0; i < 16; i++) {
    h ^= seed.charCodeAt(i % seed.length) || i + 1;
    h = Math.imul(h, 0x01000193) >>> 0;
    bytes.push((h >>> ((i % 4) * 8)) & 0xff);
  }
  const hex = bytes.map((b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}
