/**
 * LSP Client Hook
 * Main hook for managing LSP WebSocket connection
 * Composes connection, document sync, and request hooks
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { Diagnostic, InlayHint } from './types';
import { handleDiagnostics } from './diagnostics';
import { type CodeAction, type DocumentSymbol, type DocumentHighlight, type CancellationTokenLike } from './requests';
import { useLSPConnection } from './hooks/useLSPConnection';
import { useLSPDocumentSync } from './hooks/useLSPDocumentSync';
import { useLSPRequests } from './hooks/useLSPRequests';

export type OnDiagnosticsUpdate = (uri: string, diagnostics: Diagnostic[]) => void;

interface UseLSPClientReturn {
  isConnected: boolean;
  connectionError: string | null;
  diagnosticsCount: number;
  openTextDocument: (text: string, uri?: string) => void;
  changeTextDocument: (text: string, uri?: string) => void;
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
  closeTextDocument: (uri?: string) => void;
  requestInlayHints: (uri: string, range: { startLine: number; endLine: number }) => Promise<InlayHint[]>;
  requestHover: (uri: string, position: { line: number; character: number }) => Promise<{ contents: string } | null>;
  requestCompletion: (uri: string, position: { line: number; character: number }) => Promise<unknown[]>;
  requestDefinition: (uri: string, position: { line: number; character: number }) => Promise<unknown[]>;
  requestReferences: (uri: string, position: { line: number; character: number }, context?: { includeDeclaration?: boolean }) => Promise<unknown[]>;
  requestPrepareRename: (uri: string, position: { line: number; character: number }) => Promise<{ range: { start: { line: number; character: number }; end: { line: number; character: number } }; placeholder?: string } | null>;
  requestRename: (uri: string, position: { line: number; character: number }, newName: string) => Promise<unknown>;
  requestSignatureHelp: (uri: string, position: { line: number; character: number }) => Promise<unknown | null>;
  requestFormatting: (uri: string) => Promise<unknown[]>;
  requestCodeAction: (uri: string, range: { start: { line: number; character: number }; end: { line: number; character: number } }, context: { diagnostics: Array<{ range: { start: { line: number; character: number }; end: { line: number; character: number } }; severity: number; code?: string | number }> }) => Promise<CodeAction[]>;
  requestDocumentSymbols: (uri: string) => Promise<DocumentSymbol[]>;
  requestDocumentHighlight: (uri: string, position: { line: number; character: number }) => Promise<DocumentHighlight[]>;
  wsRef: React.RefObject<WebSocket | null>;
}

export function useLSPClient(
  containerId: string | undefined,
  fileUri: string,
  onDiagnosticsUpdate?: OnDiagnosticsUpdate
): UseLSPClientReturn {
  const [diagnosticsCount, setDiagnosticsCount] = useState(0);

  // Use ref for diagnostics update callback to avoid recreating connection
  const onDiagnosticsUpdateRef = useRef(onDiagnosticsUpdate);
  useEffect(() => {
    onDiagnosticsUpdateRef.current = onDiagnosticsUpdate;
  }, [onDiagnosticsUpdate]);

  // Diagnostics handler - stable callback
  const handleDiagnosticsCallback = useCallback(
    (uri: string, diagnostics: unknown[]) => {
      handleDiagnostics(
        uri,
        diagnostics as Diagnostic[],
        setDiagnosticsCount,
        onDiagnosticsUpdateRef.current
      );
    },
    [] // Empty dependencies - callback is stable
  );

  // Connection management
  const {
    isConnected,
    connectionError,
    isInitialized,
    wsRef,
  } = useLSPConnection({
    containerId,
    onDiagnostics: handleDiagnosticsCallback,
  });

  // Document synchronization
  const { openTextDocument, changeTextDocument, closeTextDocument } = useLSPDocumentSync({
    wsRef,
    isInitialized,
    currentFileUri: fileUri,
  });

  // LSP requests
  const {
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
  } = useLSPRequests({
    wsRef,
    isInitialized,
  });

  return {
    isConnected,
    connectionError,
    diagnosticsCount,
    openTextDocument,
    changeTextDocument,
    closeTextDocument,
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
    wsRef,
  };
}
