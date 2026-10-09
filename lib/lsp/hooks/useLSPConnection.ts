/**
 * LSP Connection Hook
 * Manages WebSocket connection lifecycle
 */

import { useState, useEffect, useRef } from 'react';
import { createInitializeRequest } from '../capabilities';
import { sendInitialized } from '../requests';

interface UseLSPConnectionProps {
  containerId: string | undefined;
  onDiagnostics?: (uri: string, diagnostics: unknown[]) => void;
}

interface UseLSPConnectionReturn {
  isConnected: boolean;
  connectionError: string | null;
  isInitialized: boolean;
  wsRef: React.RefObject<WebSocket | null>;
}

/** Minimal shape of the socket ref so the guard helpers are easy to test. */
export interface SocketRef {
  current: WebSocket | null;
}

/**
 * True only while `socket` is still the socket currently stored in `wsRef`.
 *
 * A socket's handlers can fire after React has already run the effect cleanup
 * and installed a newer socket (the classic `containerId` switch race), so
 * every handler checks this before mutating shared state.
 *
 * Exported for testability.
 */
export function isActiveSocket(wsRef: SocketRef, socket: WebSocket): boolean {
  return wsRef.current === socket;
}

export interface SocketCloseDeps {
  wsRef: SocketRef;
  socket: WebSocket;
  setIsConnected: (value: boolean) => void;
  setIsInitialized: (value: boolean) => void;
  isInitializedRef: { current: boolean };
}

/**
 * Handle a socket close exactly once and only for the socket that is still
 * active. A late `onclose` from a previous connection returns `false` and
 * leaves the new connection's state untouched.
 *
 * Exported for testability.
 */
export function handleSocketClose({
  wsRef,
  socket,
  setIsConnected,
  setIsInitialized,
  isInitializedRef,
}: SocketCloseDeps): boolean {
  if (!isActiveSocket(wsRef, socket)) {
    return false;
  }

  wsRef.current = null;
  isInitializedRef.current = false;
  setIsConnected(false);
  setIsInitialized(false);
  return true;
}

/**
 * Hook to manage LSP WebSocket connection
 */
export function useLSPConnection({
  containerId,
  onDiagnostics,
}: UseLSPConnectionProps): UseLSPConnectionReturn {
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const isInitializedRef = useRef(false);
  const onDiagnosticsRef = useRef(onDiagnostics);

  // Update ref when callback changes (but don't trigger reconnection)
  useEffect(() => {
    onDiagnosticsRef.current = onDiagnostics;
  }, [onDiagnostics]);

  // Main connection effect
  useEffect(() => {
    if (!containerId) {
      console.log('[LSP Connection] No containerId, skipping connection');
      return;
    }

    // Prevent duplicate connections
    if (wsRef.current) {
      const state = wsRef.current.readyState;
      if (state === WebSocket.OPEN || state === WebSocket.CONNECTING) {
        console.log('[LSP Connection] Already connected/connecting, skipping');
        return;
      }
    }

    console.log(`[LSP Connection] Connecting to container: ${containerId}`);

    // Reset connection state explicitly for the new socket instead of relying
    // on the previous socket's (possibly detached) onclose callback.
    setIsConnected(false);
    setIsInitialized(false);
    setConnectionError(null);
    isInitializedRef.current = false;

    const wsUrl = `ws://localhost:3001?containerId=${containerId}&workspace=/home/developer/workspace`;
    const socket = new WebSocket(wsUrl);
    wsRef.current = socket;

    socket.onopen = () => {
      if (!isActiveSocket(wsRef, socket)) return;

      console.log('[LSP Connection] ✓ WebSocket connected');
      setConnectionError(null);
      setIsConnected(true);

      // Send initialize request
      const initRequest = createInitializeRequest(1);
      socket.send(JSON.stringify(initRequest));
      console.log('[LSP Connection] Sent initialize request');
    };

    socket.onmessage = (event) => {
      if (!isActiveSocket(wsRef, socket)) return;

      try {
        const message = JSON.parse(event.data);

        // Handle initialize response
        if (message.id === 1 && !message.error) {
          console.log('[LSP Connection] ✓ LSP initialized');
          isInitializedRef.current = true;
          setIsInitialized(true);
          sendInitialized(socket);
        } else if (message.id === 1 && message.error) {
          console.error('[LSP Connection] Initialize failed:', message.error);
          setConnectionError(`LSP init failed: ${message.error.message}`);
        }

        // Handle diagnostics
        if (message.method === 'textDocument/publishDiagnostics' && onDiagnosticsRef.current) {
          const { uri, diagnostics } = message.params as { uri: string; diagnostics: unknown[] };
          onDiagnosticsRef.current(uri, diagnostics);
        }
      } catch (error) {
        console.error('[LSP Connection] Message parse error:', error);
      }
    };

    socket.onerror = (error) => {
      if (!isActiveSocket(wsRef, socket)) return;

      console.error('[LSP Connection] WebSocket error:', error);
      setConnectionError('WebSocket connection error');
    };

    socket.onclose = (event) => {
      // A late close from a socket that has already been replaced must not
      // tear down the live connection.
      if (!isActiveSocket(wsRef, socket)) {
        console.log('[LSP Connection] Ignoring close from stale socket');
        return;
      }

      console.log(`[LSP Connection] WebSocket closed (code: ${event.code})`);
      handleSocketClose({
        wsRef,
        socket,
        setIsConnected,
        setIsInitialized,
        isInitializedRef,
      });
    };

    return () => {
      console.log('[LSP Connection] Cleanup: closing connection');

      // Detach handlers before closing so this socket's onclose cannot fire
      // after the next effect has installed the new socket.
      socket.onopen = null;
      socket.onmessage = null;
      socket.onerror = null;
      socket.onclose = null;

      if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
        socket.close();
      }

      if (wsRef.current === socket) {
        wsRef.current = null;
        setIsConnected(false);
      }
      isInitializedRef.current = false;
      setIsInitialized(false);
    };
  }, [containerId]); // Removed onDiagnostics from dependencies - use ref instead

  return {
    isConnected,
    connectionError,
    isInitialized,
    wsRef,
  };
}
