import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
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

describe("LSP request helpers clear their per-request timer", () => {
  beforeAll(() => {
    vi.stubGlobal("WebSocket", FakeWebSocket);
  });

  afterAll(() => {
    vi.unstubAllGlobals();
  });

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("leaves no pending timer after a successful response", async () => {
    const ws = new FakeWebSocket();

    const promise = requestHover(
      asWebSocket(ws),
      "file:///a.rs",
      { line: 0, character: 0 },
      3000
    );

    const sent = JSON.parse(ws.sent[0]);
    ws.dispatch({ jsonrpc: "2.0", id: sent.id, result: { contents: "hi" } });

    await expect(promise).resolves.toEqual({ contents: "hi" });
    expect(vi.getTimerCount()).toBe(0);
  });

  it("leaves no pending timer after an error response", async () => {
    const ws = new FakeWebSocket();
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

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
      error: { code: -32601, message: "nope" },
    });

    await expect(promise).resolves.toEqual([]);
    expect(vi.getTimerCount()).toBe(0);

    errorSpy.mockRestore();
  });

  it("still resolves on timeout when no response arrives, with no timer left", async () => {
    const ws = new FakeWebSocket();

    const promise = requestHover(
      asWebSocket(ws),
      "file:///a.rs",
      { line: 0, character: 0 },
      3000
    );

    await vi.advanceTimersByTimeAsync(3000);

    await expect(promise).resolves.toBeNull();
    expect(vi.getTimerCount()).toBe(0);
  });
});
