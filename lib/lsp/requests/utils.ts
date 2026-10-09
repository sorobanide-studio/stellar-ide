/**
 * LSP Request Utilities
 * Shared utilities for LSP requests
 */

/**
 * Minimal structural type for Monaco's `CancellationToken`. Kept local so the
 * request layer does not depend on `monaco-editor`; a real Monaco token is
 * structurally compatible.
 */
export interface CancellationTokenLike {
  readonly isCancellationRequested: boolean;
  onCancellationRequested(listener: () => void): { dispose(): void };
}

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
 * Resolve a single JSON-RPC response for `requestId`, owning the listener and
 * timeout lifecycle and honouring an optional cancellation token.
 *
 * When a `token` is supplied and Monaco cancels the request (for example the
 * next keystroke cancels an in-flight completion), the listener is removed, the
 * timer cleared and a `$/cancelRequest` notification naming `requestId` is sent
 * to rust-analyzer before the promise resolves with `defaultValue`. A late
 * result therefore can never resolve the promise and overwrite a newer one.
 */
export function awaitResponse<T>(
  ws: WebSocket,
  requestId: number,
  timeout: number,
  defaultValue: T,
  select: (result: unknown) => T
  select: (result: unknown) => T,
  token?: CancellationTokenLike
): Promise<T> {
  return new Promise<T>((resolve) => {
    let settled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    function finish(value: T) {
      if (settled) {
        return;
      }
      settled = true;
    let cancellationSub: { dispose(): void } | undefined;

    function cleanup() {
      ws.removeEventListener('message', handleMessage);
      if (timer !== undefined) {
        clearTimeout(timer);
        timer = undefined;
      }
      if (cancellationSub) {
        cancellationSub.dispose();
        cancellationSub = undefined;
      }
    }

    function finish(value: T) {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
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
    timer = setTimeout(() => finish(defaultValue), timeout);

    if (token) {
      if (token.isCancellationRequested) {
        finish(defaultValue);
        return;
      }

      cancellationSub = token.onCancellationRequested(() => {
        if (ws.readyState === WebSocket.OPEN) {
          try {
            ws.send(JSON.stringify({
              jsonrpc: '2.0',
              method: '$/cancelRequest',
              params: { id: requestId },
            }));
          } catch {
            // Best-effort: the socket may already be closing.
          }
        }
        finish(defaultValue);
      });
    }
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
