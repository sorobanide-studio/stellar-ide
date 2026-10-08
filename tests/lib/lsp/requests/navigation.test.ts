import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  requestDefinition,
  requestHover,
} from "../../../../lib/lsp/requests/navigation";

// Minimal stand-in for the browser WebSocket so the request helpers can be
// exercised without a real socket. `WebSocket.OPEN` is read off the global in
// the helpers, so this class is installed as `globalThis.WebSocket`.
class FakeWebSocket extends EventTarget {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;

  readyState = FakeWebSocket.OPEN;
  sent: string[] = [];

  send(data: string): void {
    this.sent.push(data);
  }

  close(): void {
    this.readyState = FakeWebSocket.CLOSED;
  }

  dispatch(payload: unknown): void {
    const event = new Event("message") as Event & { data: string };
    event.data = JSON.stringify(payload);
    this.dispatchEvent(event);
  }
}

const asWebSocket = (ws: FakeWebSocket) => ws as unknown as WebSocket;

describe("LSP request helpers handle JSON-RPC error responses", () => {
  beforeAll(() => {
    vi.stubGlobal("WebSocket", FakeWebSocket);
  });

  afterAll(() => {
    vi.unstubAllGlobals();
  });

  it("resolves immediately on an error response instead of waiting for the timeout", async () => {
    const ws = new FakeWebSocket();
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const promise = requestHover(
      asWebSocket(ws),
      "file:///a.rs",
      { line: 0, character: 0 },
      3000
    );

    let settled = false;
    promise.then(() => {
      settled = true;
    });

    const sent = JSON.parse(ws.sent[0]);
    ws.dispatch({
      jsonrpc: "2.0",
      id: sent.id,
      error: { code: -32601, message: "method not found" },
    });

    // The 3000ms timeout has not fired, yet the promise must already be settled.
    await Promise.resolve();
    await Promise.resolve();
    expect(settled).toBe(true);
    await expect(promise).resolves.toBeNull();

    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(String(errorSpy.mock.calls[0][0])).toContain("-32601");
    expect(String(errorSpy.mock.calls[0][0])).toContain("method not found");

    errorSpy.mockRestore();
  });

  it("still resolves a successful result", async () => {
    const ws = new FakeWebSocket();

    const promise = requestDefinition(
      asWebSocket(ws),
      "file:///a.rs",
      { line: 0, character: 0 },
      3000
    );

    const sent = JSON.parse(ws.sent[0]);
    ws.dispatch({
      jsonrpc: "2.0",
      id: sent.id,
      result: [{ uri: "file:///b.rs" }],
    });

    await expect(promise).resolves.toEqual([{ uri: "file:///b.rs" }]);
  });
});
