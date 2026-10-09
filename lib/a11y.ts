/**
 * Helpers for producing short, screen-reader friendly status announcements.
 */

/**
 * Normalise a status message for an aria-live region: collapse whitespace,
 * remove long base64-ish blobs (signed transaction XDR, compiled WASM, ...)
 * and truncate to a bounded length so a single announcement can never read out
 * a whole command line or binary payload.
 */
export function sanitizeAnnouncement(message: string, maxLength = 160): string {
  const withoutBinaryPayloads = message.replace(
    /[A-Za-z0-9+/]{120,}={0,2}/g,
    "[data omitted]"
  );
  const singleLine = withoutBinaryPayloads.replace(/\s+/g, " ").trim();

  if (singleLine.length <= maxLength) {
    return singleLine;
  }

  return `${singleLine.slice(0, maxLength - 3)}...`;
}
