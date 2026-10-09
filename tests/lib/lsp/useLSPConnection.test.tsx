import { describe, expect, it, vi } from "vitest";
import {
  handleSocketClose,
  isActiveSocket,
  type SocketRef,
} from "../../../lib/lsp/hooks/useLSPConnection";

// The old socket the bug was about: it is closed by React's effect cleanup but
// its `onclose` fires *after* the new socket has been stored in the ref.
const oldSocket = { readyState: 3 } as unknown as WebSocket;
const newSocket = { readyState: 1 } as unknown as WebSocket;

describe("useLSPConnection stale-socket guards", () => {
  it("isActiveSocket only matches the socket currently in the ref", () => {
    const wsRef: SocketRef = { current: newSocket };

    expect(isActiveSocket(wsRef, newSocket)).toBe(true);
    expect(isActiveSocket(wsRef, oldSocket)).toBe(false);
  });

  it("a late onclose from the old socket cannot mutate the new connection", () => {
    const wsRef: SocketRef = { current: newSocket };
    const setIsConnected = vi.fn();
    const setIsInitialized = vi.fn();
    const isInitializedRef = { current: true };

    const handled = handleSocketClose({
      wsRef,
      socket: oldSocket,
      setIsConnected,
      setIsInitialized,
      isInitializedRef,
    });

    // The stale close is ignored...
    expect(handled).toBe(false);
    // ...and nothing belonging to the new connection is disturbed.
    expect(wsRef.current).toBe(newSocket);
    expect(isInitializedRef.current).toBe(true);
    expect(setIsConnected).not.toHaveBeenCalled();
    expect(setIsInitialized).not.toHaveBeenCalled();
  });

  it("closing the active socket clears its state exactly once", () => {
    const wsRef: SocketRef = { current: newSocket };
    const setIsConnected = vi.fn();
    const setIsInitialized = vi.fn();
    const isInitializedRef = { current: true };

    const handled = handleSocketClose({
      wsRef,
      socket: newSocket,
      setIsConnected,
      setIsInitialized,
      isInitializedRef,
    });

    expect(handled).toBe(true);
    expect(wsRef.current).toBeNull();
    expect(isInitializedRef.current).toBe(false);
    expect(setIsConnected).toHaveBeenCalledWith(false);
    expect(setIsInitialized).toHaveBeenCalledWith(false);

    // A duplicate close for the same (now stale) socket is a no-op.
    const again = handleSocketClose({
      wsRef,
      socket: newSocket,
      setIsConnected,
      setIsInitialized,
      isInitializedRef,
    });
    expect(again).toBe(false);
    expect(setIsConnected).toHaveBeenCalledTimes(1);
    expect(setIsInitialized).toHaveBeenCalledTimes(1);
  });
});
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type Mock,
} from "vitest";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { createInitializeRequest } from "@/lib/lsp/capabilities";
import { sendInitialized } from "@/lib/lsp/requests";
import { useLSPConnection } from "@/lib/lsp/hooks/useLSPConnection";

vi.mock("@/lib/lsp/requests", () => ({
  sendInitialized: vi.fn(),
}));

// React 19 requires this flag so `act(...)` does not warn about the test env.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

class MockWebSocket {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;
  static instances: MockWebSocket[] = [];
  static last: MockWebSocket | null = null;

  url: string;
  readyState = MockWebSocket.CONNECTING;
  sent: string[] = [];
  closeCalls = 0;
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onerror: ((event: unknown) => void) | null = null;
  onclose: ((event: { code: number }) => void) | null = null;

  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);
    MockWebSocket.last = this;
  }

  send(data: string): void {
    this.sent.push(data);
  }

  close(): void {
    this.closeCalls += 1;
    this.readyState = MockWebSocket.CLOSED;
  }

  open(): void {
    this.readyState = MockWebSocket.OPEN;
    this.onopen?.();
  }

  message(payload: unknown): void {
    this.onmessage?.({ data: JSON.stringify(payload) });
  }

  serverClose(code = 1000): void {
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.({ code });
  }
}

function renderConnection(onDiagnostics: Mock = vi.fn()) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  const result: { current: ReturnType<typeof useLSPConnection> } = {
    current: undefined as unknown as ReturnType<typeof useLSPConnection>,
  };

  function Probe() {
    result.current = useLSPConnection({
      containerId: "container-123",
      onDiagnostics,
    });
    return null;
  }

  act(() => {
    root.render(createElement(Probe));
  });

  return {
    result,
    onDiagnostics,
    rerender: () => {
      act(() => {
        root.render(createElement(Probe));
      });
    },
    unmount: () => {
      act(() => root.unmount());
      container.remove();
    },
  };
}

beforeEach(() => {
  MockWebSocket.instances = [];
  MockWebSocket.last = null;
  (sendInitialized as unknown as Mock).mockClear();
  vi.stubGlobal("WebSocket", MockWebSocket);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("useLSPConnection", () => {
  it("connects to the container WebSocket and sends the initialize request", () => {
    renderConnection();
    const socket = MockWebSocket.last as MockWebSocket;

    expect(MockWebSocket.instances).toHaveLength(1);
    expect(socket.url).toBe(
      "ws://localhost:3001?containerId=container-123&workspace=/home/developer/workspace",
    );

    act(() => socket.open());

    expect(socket.sent).toHaveLength(1);
    expect(JSON.parse(socket.sent[0])).toEqual(createInitializeRequest(1));
  });

  it("only flips isInitialized for the id:1 response and then sends `initialized`", () => {
    const { result } = renderConnection();
    const socket = MockWebSocket.last as MockWebSocket;
    act(() => socket.open());

    act(() => socket.message({ id: 2, result: {} }));
    expect(result.current.isInitialized).toBe(false);
    expect(sendInitialized).not.toHaveBeenCalled();

    act(() => socket.message({ id: 1, result: { capabilities: {} } }));
    expect(result.current.isInitialized).toBe(true);
    expect(sendInitialized).toHaveBeenCalledTimes(1);
    expect((sendInitialized as unknown as Mock).mock.calls[0][0]).toBe(socket);
  });

  it("routes publishDiagnostics to the onDiagnostics callback", () => {
    const onDiagnostics = vi.fn();
    renderConnection(onDiagnostics);
    const socket = MockWebSocket.last as MockWebSocket;
    act(() => socket.open());

    const diagnostics = [{ message: "unused variable", severity: 2 }];
    act(() =>
      socket.message({
        method: "textDocument/publishDiagnostics",
        params: { uri: "file:///src/main.rs", diagnostics },
      }),
    );

    expect(onDiagnostics).toHaveBeenCalledWith(
      "file:///src/main.rs",
      diagnostics,
    );
  });

  it("does not reconnect on re-render", () => {
    const { rerender } = renderConnection();
    expect(MockWebSocket.instances).toHaveLength(1);

    rerender();
    rerender();

    expect(MockWebSocket.instances).toHaveLength(1);
  });

  it("resets connection state when the server closes the socket", () => {
    const { result } = renderConnection();
    const socket = MockWebSocket.last as MockWebSocket;
    act(() => socket.open());
    expect(result.current.isConnected).toBe(true);

    act(() => socket.serverClose(1000));

    expect(result.current.isConnected).toBe(false);
    expect(result.current.isInitialized).toBe(false);
  });

  it("closes the socket exactly once on unmount", () => {
    const { unmount } = renderConnection();
    const socket = MockWebSocket.last as MockWebSocket;
    act(() => socket.open());

    unmount();

    expect(socket.closeCalls).toBe(1);
  });
});
