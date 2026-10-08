/**
 * LSP Refactoring Requests
 * Code refactoring features (rename, code actions)
 */

import { awaitResponse, createRequestId, type CancellationTokenLike, TextEdit } from './utils';

/**
 * Request prepare rename (check if rename is possible)
 */
export function requestPrepareRename(
  ws: WebSocket,
  uri: string,
  position: { line: number; character: number },
  token?: CancellationTokenLike,
  timeout = 3000
): Promise<{ range: { start: { line: number; character: number }; end: { line: number; character: number } }; placeholder?: string } | null> {
  if (ws.readyState !== WebSocket.OPEN) {
    return Promise.resolve(null);
  }

  const requestId = createRequestId();
  const response = awaitResponse<{ range: { start: { line: number; character: number }; end: { line: number; character: number } }; placeholder?: string } | null>(
    ws,
    requestId,
    timeout,
    null,
    // Result can be { range, placeholder } or just { range }
    (result) => (result as { range: { start: { line: number; character: number }; end: { line: number; character: number } }; placeholder?: string }) || null,
    token
  );

  ws.send(JSON.stringify({
    jsonrpc: '2.0',
    method: 'textDocument/prepareRename',
    params: {
      textDocument: { uri },
      position,
    },
    id: requestId,
  }));

  return response;
}

/**
 * Request rename symbol
 */
export function requestRename(
  ws: WebSocket,
  uri: string,
  position: { line: number; character: number },
  newName: string,
  token?: CancellationTokenLike,
  timeout = 5000
): Promise<{ changes?: Record<string, TextEdit[]> } | null> {
  if (ws.readyState !== WebSocket.OPEN) {
    return Promise.resolve(null);
  }

  const requestId = createRequestId();
  const response = awaitResponse<{ changes?: Record<string, TextEdit[]> } | null>(
    ws,
    requestId,
    timeout,
    null,
    (result) => (result as { changes?: Record<string, TextEdit[]> }) || null,
    token
  );

  ws.send(JSON.stringify({
    jsonrpc: '2.0',
    method: 'textDocument/rename',
    params: {
      textDocument: { uri },
      position,
      newName,
    },
    id: requestId,
  }));

  return response;
}

/**
 * Request code actions from LSP
 */
export function requestCodeAction(
  ws: WebSocket,
  uri: string,
  range: { start: { line: number; character: number }; end: { line: number; character: number } },
  context: { diagnostics: Array<{ range: { start: { line: number; character: number }; end: { line: number; character: number } }; severity: number; code?: string | number }> },
  token?: CancellationTokenLike,
  timeout = 5000
): Promise<CodeAction[]> {
  if (ws.readyState !== WebSocket.OPEN) {
    return Promise.resolve([]);
  }

  const requestId = createRequestId();
  const response = awaitResponse<CodeAction[]>(ws, requestId, timeout, [], (result) => {
    // Handle both array and {commands: []} or {codeActions: []} formats
    if (Array.isArray(result)) {
      return result as CodeAction[];
    }
    const shaped = result as { commands?: CodeAction[]; codeActions?: CodeAction[] } | null;
    if (shaped?.commands) {
      return shaped.commands;
    }
    if (shaped?.codeActions) {
      return shaped.codeActions;
    }
    return [];
  }, token);

  ws.send(JSON.stringify({
    jsonrpc: '2.0',
    method: 'textDocument/codeAction',
    params: {
      textDocument: { uri },
      range,
      context,
    },
    id: requestId,
  }));

  return response;
}

// CodeAction interface
export interface CodeAction {
  title: string;
  kind?: string;
  diagnostics?: Array<{
    range: { start: { line: number; character: number }; end: { line: number; character: number } };
    severity: number;
    code?: string | number;
    message: string;
  }>;
  edit?: {
    changes?: Record<string, TextEdit[]>;
  };
  command?: {
    command: string;
    title: string;
    arguments?: unknown[];
  };
  isPreferred?: boolean;
}
