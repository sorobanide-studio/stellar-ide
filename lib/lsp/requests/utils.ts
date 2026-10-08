/**
 * LSP Request Utilities
 * Shared utilities for LSP requests
 */

let lastRequestId = 0;

/**
 * Create a unique request ID.
 *
 * Uses `Date.now()` as the base but never returns the same value twice: if the
 * clock has not advanced since the previous call (or has gone backwards), the
 * previous id is incremented instead. This keeps ids monotonically increasing,
 * integer and collision-free even for thousands of calls within one millisecond
 * — a plain `Date.now() + random` collides there and resolves the wrong promise.
 */
export function createRequestId(): number {
  const now = Date.now();
  lastRequestId = now > lastRequestId ? now : lastRequestId + 1;
  return lastRequestId;
}

/**
 * Shared TextEdit interface
 */
export interface TextEdit {
  range: {
    start: { line: number; character: number };
    end: { line: number; character: number };
  };
  newText: string;
}
