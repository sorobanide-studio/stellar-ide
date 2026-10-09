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
