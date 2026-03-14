/**
 * Generate a short, unique entry ID (6-char hex string).
 * @returns 6-character hexadecimal string
 */
export function generateEntryId(): string {
  return Math.random().toString(16).slice(2, 8)
}
