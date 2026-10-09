/**
 * LSP Navigation Requests
 * Code navigation features (definition, references, hover)
 */

import { awaitResponse, createRequestId } from './utils';
import { awaitResponse, createRequestId, type CancellationTokenLike } from './utils';

/**
 * Request go to definition
 */
export function requestDefinition(
  ws: WebSocket,
  uri: string,
  position: { line: number; character: number },
  token?: CancellationTokenLike,
  timeout = 3000
): Promise<unknown[]> {
  if (ws.readyState !== WebSocket.OPEN) {
    return Promise.resolve([]);
  }

  const requestId = createRequestId();
  const response = awaitResponse<unknown[]>(ws, requestId, timeout, [], (result) =>
    Array.isArray(result) ? result : result ? [result] : []
  const response = awaitResponse<unknown[]>(
    ws,
    requestId,
    timeout,
    [],
    (result) => (Array.isArray(result) ? result : result ? [result] : []),
    token
  );

  ws.send(JSON.stringify({
    jsonrpc: '2.0',
    method: 'textDocument/definition',
    params: {
      textDocument: { uri },
      position,
    },
    id: requestId,
  }));

  return response;
}

/**
 * Request find all references
 */
export function requestReferences(
  ws: WebSocket,
  uri: string,
  position: { line: number; character: number },
  context?: { includeDeclaration?: boolean },
  token?: CancellationTokenLike,
  timeout = 5000
): Promise<unknown[]> {
  if (ws.readyState !== WebSocket.OPEN) {
    return Promise.resolve([]);
  }

  const requestId = createRequestId();
  const response = awaitResponse<unknown[]>(ws, requestId, timeout, [], (result) =>
    Array.isArray(result) ? result : []
  const response = awaitResponse<unknown[]>(
    ws,
    requestId,
    timeout,
    [],
    (result) => (Array.isArray(result) ? result : []),
    token
  );

  ws.send(JSON.stringify({
    jsonrpc: '2.0',
    method: 'textDocument/references',
    params: {
      textDocument: { uri },
      position,
      context: context || { includeDeclaration: true },
    },
    id: requestId,
  }));

  return response;
}

/**
 * Request hover information
 */
export function requestHover(
  ws: WebSocket,
  uri: string,
  position: { line: number; character: number },
  token?: CancellationTokenLike,
  timeout = 3000
): Promise<{ contents: string } | null> {
  if (ws.readyState !== WebSocket.OPEN) {
    return Promise.resolve(null);
  }

  const requestId = createRequestId();
  const response = awaitResponse<{ contents: string } | null>(
    ws,
    requestId,
    timeout,
    null,
    (result) => (result as { contents: string }) || null
    (result) => (result as { contents: string }) || null,
    token
  );

  ws.send(JSON.stringify({
    jsonrpc: '2.0',
    method: 'textDocument/hover',
    params: {
      textDocument: { uri },
      position,
    },
    id: requestId,
  }));

  return response;
}

/**
 * Document Symbol Types
 */
export interface DocumentSymbol {
  name: string;
  detail?: string;
  kind: number; // SymbolKind enum
  deprecated?: boolean;
  range: {
    start: { line: number; character: number };
    end: { line: number; character: number };
  };
  selectionRange: {
    start: { line: number; character: number };
    end: { line: number; character: number };
  };
  children?: DocumentSymbol[];
}

/**
 * Request document symbols (outline view)
 */
export function requestDocumentSymbols(
  ws: WebSocket,
  uri: string,
  token?: CancellationTokenLike,
  timeout = 5000
): Promise<DocumentSymbol[]> {
  if (ws.readyState !== WebSocket.OPEN) {
    return Promise.resolve([]);
  }

  const requestId = createRequestId();
  const response = awaitResponse<DocumentSymbol[]>(ws, requestId, timeout, [], (result) =>
    Array.isArray(result) ? result : []
  const response = awaitResponse<DocumentSymbol[]>(
    ws,
    requestId,
    timeout,
    [],
    (result) => (Array.isArray(result) ? result : []),
    token
  );

  ws.send(JSON.stringify({
    jsonrpc: '2.0',
    method: 'textDocument/documentSymbol',
    params: {
      textDocument: { uri },
    },
    id: requestId,
  }));

  return response;
}

/**
 * Document Highlight Types
 */
export interface DocumentHighlight {
  range: {
    start: { line: number; character: number };
    end: { line: number; character: number };
  };
  kind?: number; // DocumentHighlightKind: Text = 1, Read = 2, Write = 3
}

/**
 * Request document highlight (highlight all occurrences of symbol at cursor)
 */
export function requestDocumentHighlight(
  ws: WebSocket,
  uri: string,
  position: { line: number; character: number },
  token?: CancellationTokenLike,
  timeout = 3000
): Promise<DocumentHighlight[]> {
  if (ws.readyState !== WebSocket.OPEN) {
    return Promise.resolve([]);
  }

  const requestId = createRequestId();
  const response = awaitResponse<DocumentHighlight[]>(ws, requestId, timeout, [], (result) =>
    Array.isArray(result) ? result : []
  const response = awaitResponse<DocumentHighlight[]>(
    ws,
    requestId,
    timeout,
    [],
    (result) => (Array.isArray(result) ? result : []),
    token
  );

  ws.send(JSON.stringify({
    jsonrpc: '2.0',
    method: 'textDocument/documentHighlight',
    params: {
      textDocument: { uri },
      position,
    },
    id: requestId,
  }));

  return response;
}
