/**
 * LSP Inlay Hints Request
 * Inlay hints for type information
 */

import { InlayHint } from '../types';
import { awaitResponse, createRequestId, type CancellationTokenLike } from './utils';

/**
 * Request inlay hints from LSP
 */
export function requestInlayHints(
  ws: WebSocket,
  uri: string,
  range: { startLine: number; endLine: number },
  token?: CancellationTokenLike,
  timeout = 5000
): Promise<InlayHint[]> {
  if (ws.readyState !== WebSocket.OPEN) {
    return Promise.resolve([]);
  }

  const requestId = createRequestId();
  const response = awaitResponse<InlayHint[]>(
    ws,
    requestId,
    timeout,
    [],
    (result) => (result as InlayHint[]) || [],
    token
  );

  ws.send(JSON.stringify({
    jsonrpc: '2.0',
    method: 'textDocument/inlayHint',
    params: {
      textDocument: { uri },
      range: {
        start: { line: range.startLine, character: 0 },
        end: { line: range.endLine, character: 0 },
      },
    },
    id: requestId,
  }));

  return response;
}
