/**
 * LSP Editing Requests
 * Code editing features (completion, signature help, formatting)
 */

import { awaitResponse, createRequestId, TextEdit } from './utils';

/**
 * Request code completion
 */
export function requestCompletion(
  ws: WebSocket,
  uri: string,
  position: { line: number; character: number },
  timeout = 3000
): Promise<unknown[]> {
  if (ws.readyState !== WebSocket.OPEN) {
    return Promise.resolve([]);
  }

  const requestId = createRequestId();
  const response = awaitResponse<unknown[]>(ws, requestId, timeout, [], (result) => {
    // Handle both array and {items: []} formats
    return Array.isArray(result) ? result : (result as { items?: unknown[] })?.items || [];
  });

  ws.send(JSON.stringify({
    jsonrpc: '2.0',
    method: 'textDocument/completion',
    params: {
      textDocument: { uri },
      position,
    },
    id: requestId,
  }));

  return response;
}

/**
 * Request signature help
 */
export function requestSignatureHelp(
  ws: WebSocket,
  uri: string,
  position: { line: number; character: number },
  timeout = 3000
): Promise<unknown | null> {
  if (ws.readyState !== WebSocket.OPEN) {
    return Promise.resolve(null);
  }

  const requestId = createRequestId();
  const response = awaitResponse<unknown | null>(
    ws,
    requestId,
    timeout,
    null,
    (result) => result || null
  );

  ws.send(JSON.stringify({
    jsonrpc: '2.0',
    method: 'textDocument/signatureHelp',
    params: {
      textDocument: { uri },
      position,
    },
    id: requestId,
  }));

  return response;
}

/**
 * Request document formatting
 */
export function requestFormatting(
  ws: WebSocket,
  uri: string,
  timeout = 5000
): Promise<TextEdit[]> {
  if (ws.readyState !== WebSocket.OPEN) {
    return Promise.resolve([]);
  }

  const requestId = createRequestId();
  const response = awaitResponse<TextEdit[]>(ws, requestId, timeout, [], (result) =>
    (result as TextEdit[]) || []
  );

  ws.send(JSON.stringify({
    jsonrpc: '2.0',
    method: 'textDocument/formatting',
    params: {
      textDocument: { uri },
      options: {
        tabSize: 4,
        insertSpaces: true,
      },
    },
    id: requestId,
  }));

  return response;
}
