/**
 * LSP Requests Hook
 * Wraps all LSP request functions with connection checks
 */

import { useCallback } from 'react';
import { InlayHint } from '../types';
import { type CodeAction, type CancellationTokenLike } from '../requests';
import {
  requestInlayHints as sendInlayHintsRequest,
  requestHover as sendHoverRequest,
  requestCompletion as sendCompletionRequest,
  requestDefinition as sendDefinitionRequest,
  requestReferences as sendReferencesRequest,
  requestPrepareRename as sendPrepareRenameRequest,
  requestRename as sendRenameRequest,
  requestSignatureHelp as sendSignatureHelpRequest,
  requestFormatting as sendFormattingRequest,
  requestCodeAction as sendCodeActionRequest,
  requestDocumentSymbols as sendDocumentSymbolsRequest,
  requestDocumentHighlight as sendDocumentHighlightRequest,
  type DocumentSymbol,
  type DocumentHighlight,
} from '../requests';

interface UseLSPRequestsProps {
  wsRef: React.RefObject<WebSocket | null>;
  isInitialized: boolean;
}

interface UseLSPRequestsReturn {
  requestInlayHints: (uri: string, range: { startLine: number; endLine: number }, token?: CancellationTokenLike) => Promise<InlayHint[]>;
  requestHover: (uri: string, position: { line: number; character: number }, token?: CancellationTokenLike) => Promise<{ contents: string } | null>;
  requestCompletion: (uri: string, position: { line: number; character: number }, token?: CancellationTokenLike) => Promise<unknown[]>;
  requestDefinition: (uri: string, position: { line: number; character: number }, token?: CancellationTokenLike) => Promise<unknown[]>;
  requestReferences: (uri: string, position: { line: number; character: number }, context?: { includeDeclaration?: boolean }, token?: CancellationTokenLike) => Promise<unknown[]>;
  requestPrepareRename: (uri: string, position: { line: number; character: number }, token?: CancellationTokenLike) => Promise<{ range: { start: { line: number; character: number }; end: { line: number; character: number } }; placeholder?: string } | null>;
  requestRename: (uri: string, position: { line: number; character: number }, newName: string, token?: CancellationTokenLike) => Promise<unknown>;
  requestSignatureHelp: (uri: string, position: { line: number; character: number }, token?: CancellationTokenLike) => Promise<unknown | null>;
  requestFormatting: (uri: string, token?: CancellationTokenLike) => Promise<unknown[]>;
  requestCodeAction: (uri: string, range: { start: { line: number; character: number }; end: { line: number; character: number } }, context: { diagnostics: Array<{ range: { start: { line: number; character: number }; end: { line: number; character: number } }; severity: number; code?: string | number }> }, token?: CancellationTokenLike) => Promise<CodeAction[]>;
  requestDocumentSymbols: (uri: string, token?: CancellationTokenLike) => Promise<DocumentSymbol[]>;
  requestDocumentHighlight: (uri: string, position: { line: number; character: number }, token?: CancellationTokenLike) => Promise<DocumentHighlight[]>;
}

/**
 * Hook to manage all LSP request functions
 */
export function useLSPRequests({
  wsRef,
  isInitialized,
}: UseLSPRequestsProps): UseLSPRequestsReturn {
  // Request inlay hints
  const requestInlayHints = useCallback(
    (uri: string, range: { startLine: number; endLine: number }, token?: CancellationTokenLike): Promise<InlayHint[]> => {
      const ws = wsRef.current;
      if (!ws || !isInitialized) {
        return Promise.resolve([]);
      }
      return sendInlayHintsRequest(ws, uri, range, token);
    },
    [wsRef, isInitialized]
  );

  // Request hover
  const requestHover = useCallback(
    (uri: string, position: { line: number; character: number }, token?: CancellationTokenLike): Promise<{ contents: string } | null> => {
      const ws = wsRef.current;
      if (!ws || !isInitialized) {
        return Promise.resolve(null);
      }
      return sendHoverRequest(ws, uri, position, token);
    },
    [wsRef, isInitialized]
  );

  // Request completion
  const requestCompletion = useCallback(
    (uri: string, position: { line: number; character: number }, token?: CancellationTokenLike): Promise<unknown[]> => {
      const ws = wsRef.current;
      if (!ws || !isInitialized) {
        return Promise.resolve([]);
      }
      return sendCompletionRequest(ws, uri, position, token);
    },
    [wsRef, isInitialized]
  );

  // Request definition
  const requestDefinition = useCallback(
    (uri: string, position: { line: number; character: number }, token?: CancellationTokenLike): Promise<unknown[]> => {
      const ws = wsRef.current;
      if (!ws || !isInitialized) {
        return Promise.resolve([]);
      }
      return sendDefinitionRequest(ws, uri, position, token);
    },
    [wsRef, isInitialized]
  );

  // Request references
  const requestReferences = useCallback(
    (uri: string, position: { line: number; character: number }, context?: { includeDeclaration?: boolean }, token?: CancellationTokenLike): Promise<unknown[]> => {
      const ws = wsRef.current;
      if (!ws || !isInitialized) {
        return Promise.resolve([]);
      }
      return sendReferencesRequest(ws, uri, position, context, token);
    },
    [wsRef, isInitialized]
  );

  // Request prepare rename
  const requestPrepareRename = useCallback(
    (uri: string, position: { line: number; character: number }, token?: CancellationTokenLike): Promise<{ range: { start: { line: number; character: number }; end: { line: number; character: number } }; placeholder?: string } | null> => {
      const ws = wsRef.current;
      if (!ws || !isInitialized) {
        return Promise.resolve(null);
      }
      return sendPrepareRenameRequest(ws, uri, position, token);
    },
    [wsRef, isInitialized]
  );

  // Request rename
  const requestRename = useCallback(
    (uri: string, position: { line: number; character: number }, newName: string, token?: CancellationTokenLike): Promise<unknown> => {
      const ws = wsRef.current;
      if (!ws || !isInitialized) {
        return Promise.resolve(null);
      }
      return sendRenameRequest(ws, uri, position, newName, token);
    },
    [wsRef, isInitialized]
  );

  // Request signature help
  const requestSignatureHelp = useCallback(
    (uri: string, position: { line: number; character: number }, token?: CancellationTokenLike): Promise<unknown | null> => {
      const ws = wsRef.current;
      if (!ws || !isInitialized) {
        return Promise.resolve(null);
      }
      return sendSignatureHelpRequest(ws, uri, position, token);
    },
    [wsRef, isInitialized]
  );

  // Request document formatting
  const requestFormatting = useCallback(
    (uri: string, token?: CancellationTokenLike): Promise<unknown[]> => {
      const ws = wsRef.current;
      if (!ws || !isInitialized) {
        return Promise.resolve([]);
      }
      return sendFormattingRequest(ws, uri, token);
    },
    [wsRef, isInitialized]
  );

  // Request code actions
  const requestCodeAction = useCallback(
    (
      uri: string,
      range: { start: { line: number; character: number }; end: { line: number; character: number } },
      context: { diagnostics: Array<{ range: { start: { line: number; character: number }; end: { line: number; character: number } }; severity: number; code?: string | number }> },
      token?: CancellationTokenLike
    ): Promise<CodeAction[]> => {
      const ws = wsRef.current;
      if (!ws || !isInitialized) {
        return Promise.resolve([]);
      }
      return sendCodeActionRequest(ws, uri, range, context, token);
    },
    [wsRef, isInitialized]
  );

  // Request document symbols
  const requestDocumentSymbols = useCallback(
    (uri: string, token?: CancellationTokenLike): Promise<DocumentSymbol[]> => {
      const ws = wsRef.current;
      if (!ws || !isInitialized) {
        return Promise.resolve([]);
      }
      return sendDocumentSymbolsRequest(ws, uri, token);
    },
    [wsRef, isInitialized]
  );

  // Request document highlight
  const requestDocumentHighlight = useCallback(
    (uri: string, position: { line: number; character: number }, token?: CancellationTokenLike): Promise<DocumentHighlight[]> => {
      const ws = wsRef.current;
      if (!ws || !isInitialized) {
        return Promise.resolve([]);
      }
      return sendDocumentHighlightRequest(ws, uri, position, token);
    },
    [wsRef, isInitialized]
  );

  return {
    requestInlayHints,
    requestHover,
    requestCompletion,
    requestDefinition,
    requestReferences,
    requestPrepareRename,
    requestRename,
    requestSignatureHelp,
    requestFormatting,
    requestCodeAction,
    requestDocumentSymbols,
    requestDocumentHighlight,
  };
}
