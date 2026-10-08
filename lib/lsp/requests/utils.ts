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
 * Resolve a single JSON-RPC response for `requestId`, owning the whole
 * listener + timeout lifecycle.
 *
 * Every request helper in this folder used to attach its own `message`
 * listener and `setTimeout`, then remove only the listener when a response
 * arrived: the timer survived for its full 3-5s and later called `resolve`
 * again on an already-settled promise. This helper is the single place that
 * manages that lifecycle, so it can clear the timer on every resolution path —
 * result, JSON-RPC error, and timeout — and can never resolve twice. Because
 * all request modules use it, a new request cannot reintroduce the leak.
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
    let timer: ReturnType<typeof setTimeout> | undefined;

    function finish(value: T) {
      if (settled) {
        return;
      }
      settled = true;
      ws.removeEventListener('message', handleMessage);
      if (timer !== undefined) {
        clearTimeout(timer);
        timer = undefined;
      }
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

    timer = setTimeout(() => finish(defaultValue), timeout);
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
