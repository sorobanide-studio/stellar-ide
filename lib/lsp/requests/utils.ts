/**
 * LSP Request Utilities
 * Shared utilities for LSP requests
 */

/**
 * Minimal JSON-RPC response shape handled here.
 */
interface LspResponse {
  id?: unknown;
  result?: unknown;
  error?: { code?: number; message?: string };
}

/**
 * Create a unique request ID
 */
export function createRequestId(): number {
  return Date.now() + Math.floor(Math.random() * 1000);
}

/**
 * Resolve a single JSON-RPC response for `requestId`.
 *
 * Every request helper in this folder used to attach its own `message`
 * listener and only ever look at `message.result`, so a JSON-RPC error response
 * (`{ id, error: { code, message } }`) was silently ignored and the caller
 * waited out the whole timeout before receiving an empty result. This helper
 * centralises that listener so a new request cannot forget the error branch:
 * an error response resolves immediately with `defaultValue`, logging the
 * server's code and message exactly once.
 */
export function awaitResponse<T>(
  ws: WebSocket,
  requestId: number,
  timeout: number,
  defaultValue: T,
  select: (result: unknown) => T
): Promise<T> {
  return new Promise<T>((resolve) => {
    let settled = false;

    function finish(value: T) {
      if (settled) {
        return;
      }
      settled = true;
      ws.removeEventListener('message', handleMessage);
      resolve(value);
    }

    function handleMessage(event: MessageEvent) {
      let message: LspResponse;
      try {
        message = JSON.parse(event.data);
      } catch {
        // Ignore parse errors
        return;
      }

      if (message?.id !== requestId) {
        return;
      }

      if (message.error) {
        console.error(
          `[LSP] Request ${requestId} failed (code ${message.error.code ?? 'unknown'}): ${
            message.error.message ?? 'unknown error'
          }`
        );
        finish(defaultValue);
        return;
      }

      finish(select(message.result));
    }

    ws.addEventListener('message', handleMessage);

    setTimeout(() => finish(defaultValue), timeout);
  });
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
