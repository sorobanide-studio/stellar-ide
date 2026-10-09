import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { CancellationTokenLike } from "../../../../lib/lsp/requests";
import { requestCompletion } from "../../../../lib/lsp/requests/editing";
import { requestHover } from "../../../../lib/lsp/requests/navigation";

type Listener = (event: Event) => void;

/**
 * Minimal WebSocket stand-in that also tracks how many `message` listeners are
 * attached, so a test can assert a cancelled request removed its listener.
 */
class FakeWebSocket {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;

  readyState = FakeWebSocket.OPEN;
  sent: string[] = [];
  private listeners = new Set<Listener>();

  addEventListener(type: string, listener: Listener): void {
    if (type === "message") this.listeners.add(listener);
  }

  removeEventListener(type: string, listener: Listener): void {
    if (type === "message") this.listeners.delete(listener);
  }

  get messageListenerCount(): number {
    return this.listeners.size;
  }

  send(data: string): void {
    this.sent.push(data);
  }

  close(): void {
    this.readyState = FakeWebSocket.CLOSED;
  }

  dispatch(payload: unknown): void {
    const event = { data: JSON.stringify(payload) } as unknown as Event;
    for (const listener of [...this.listeners]) listener(event);
  }
}

interface FakeToken extends CancellationTokenLike {
  cancel(): void;
}

function createFakeToken(): FakeToken {
  const listeners = new Set<() => void>();
  const token: FakeToken = {
    isCancellationRequested: false,
    onCancellationRequested(listener: () => void) {
      listeners.add(listener);
      return { dispose: () => listeners.delete(listener) };
    },
    cancel() {
      token.isCancellationRequested = true;
      for (const listener of [...listeners]) listener();
    },
  };
  return token;
}

const asWebSocket = (ws: FakeWebSocket) => ws as unknown as WebSocket;
const sentMessages = (ws: FakeWebSocket) => ws.sent.map((s) => JSON.parse(s));
const cancelNotifications = (ws: FakeWebSocket) =>
  sentMessages(ws).filter((m) => m.method === "$/cancelRequest");

describe("request helpers honour the CancellationToken", () => {
  beforeAll(() => {
    vi.stubGlobal("WebSocket", FakeWebSocket);
  });

  afterAll(() => {
    vi.unstubAllGlobals();
  });

  it("cancelling removes the listener, sends $/cancelRequest and resolves as cancelled", async () => {
    const ws = new FakeWebSocket();
    const token = createFakeToken();

    const promise = requestHover(asWebSocket(ws), "file:///a.rs", { line: 0, character: 0 }, token);
    expect(ws.messageListenerCount).toBe(1);

    const requestId = JSON.parse(ws.sent[0]).id;
    token.cancel();

    await expect(promise).resolves.toBeNull();
    expect(ws.messageListenerCount).toBe(0);

    const cancels = cancelNotifications(ws);
    expect(cancels).toHaveLength(1);
    expect(cancels[0].params).toEqual({ id: requestId });

    // A late result must not resolve the promise again.
    let resolutions = 0;
    promise.then(() => {
      resolutions += 1;
    });
    ws.dispatch({ jsonrpc: "2.0", id: requestId, result: { contents: "stale" } });
    await Promise.resolve();
    await Promise.resolve();
    expect(resolutions).toBe(1);
  });

  it("an already-cancelled token resolves immediately without sending a cancellation", async () => {
    const ws = new FakeWebSocket();
    const token = createFakeToken();
    token.cancel();

    const promise = requestCompletion(asWebSocket(ws), "file:///a.rs", { line: 0, character: 0 }, token);

    await expect(promise).resolves.toEqual([]);
    expect(cancelNotifications(ws)).toHaveLength(0);
    expect(ws.messageListenerCount).toBe(0);
  });

  it("a cancelled request's stale result cannot overwrite a newer request", async () => {
    const ws = new FakeWebSocket();

    const firstToken = createFakeToken();
    const first = requestHover(asWebSocket(ws), "file:///a.rs", { line: 0, character: 0 }, firstToken);
    const firstId = JSON.parse(ws.sent[0]).id;

    firstToken.cancel();
    await expect(first).resolves.toBeNull();

    const secondToken = createFakeToken();
    const second = requestHover(asWebSocket(ws), "file:///a.rs", { line: 0, character: 0 }, secondToken);
    const secondId = JSON.parse(ws.sent[ws.sent.length - 1]).id;

    // The first (cancelled) request's late result arrives after the newer one...
    ws.dispatch({ jsonrpc: "2.0", id: firstId, result: { contents: "stale" } });
    ws.dispatch({ jsonrpc: "2.0", id: secondId, result: { contents: "fresh" } });

    await expect(second).resolves.toEqual({ contents: "fresh" });
  });
});
