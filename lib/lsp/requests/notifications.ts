/**
 * LSP Notifications
 * Document synchronization notifications
 * (didOpen, didChange, didClose, initialized)
 */

/**
 * Send a textDocument/didOpen notification
 */
export function sendDidOpen(
  ws: WebSocket,
  uri: string,
  text: string,
  version: number
): void {
  ws.send(JSON.stringify({
    jsonrpc: '2.0',
    method: 'textDocument/didOpen',
    params: {
      textDocument: {
        uri,
        languageId: 'rust',
        version,
        text,
      },
    },
  }));
}

/**
 * Send a textDocument/didChange notification
 */
export function sendDidChange(
  ws: WebSocket,
  uri: string,
  text: string,
  version: number
): void {
  ws.send(JSON.stringify({
    jsonrpc: '2.0',
    method: 'textDocument/didChange',
    params: {
      textDocument: {
        uri,
        version,
      },
      contentChanges: [{ text }],
    },
  }));
}

/**
 * Send a textDocument/didClose notification
 */
export function sendDidClose(ws: WebSocket, uri: string): void {
  ws.send(JSON.stringify({
    jsonrpc: '2.0',
    method: 'textDocument/didClose',
    params: {
      textDocument: {
        uri,
      },
    },
  }));
}

/**
 * Send initialized notification
 */
export function sendInitialized(ws: WebSocket): void {
  ws.send(JSON.stringify({
    jsonrpc: '2.0',
    method: 'initialized',
    params: {},
  }));
}
