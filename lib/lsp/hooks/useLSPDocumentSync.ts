/**
 * LSP Document Sync Hook
 * Handles document synchronization (didOpen, didChange)
 */

import { useCallback, useRef } from 'react';
import { sendDidOpen, sendDidChange, sendDidClose } from '../requests';
import { markUriOpen, markUriClosed } from '../diagnostics';

interface UseLSPDocumentSyncProps {
  wsRef: React.RefObject<WebSocket | null>;
  isInitialized: boolean;
  currentFileUri: string;
}

interface UseLSPDocumentSyncReturn {
  openTextDocument: (text: string, uri?: string) => void;
  changeTextDocument: (text: string, uri?: string) => void;
  closeTextDocument: (uri?: string) => void;
}

/**
 * Hook to manage document synchronization with LSP
 */
export function useLSPDocumentSync({
  wsRef,
  isInitialized,
  currentFileUri,
}: UseLSPDocumentSyncProps): UseLSPDocumentSyncReturn {
  const versionRef = useRef(1);
  const openedFilesRef = useRef<Set<string>>(new Set());
  const currentFileUriRef = useRef<string>('');

  // Update current file URI ref
  currentFileUriRef.current = currentFileUri;

  // Open text document
  const openTextDocument = useCallback((text: string, uri?: string) => {
    const ws = wsRef.current;
    const effectiveUri = uri || currentFileUriRef.current;

    if (!ws || ws.readyState !== WebSocket.OPEN || !effectiveUri) {
      console.log('[LSP DocumentSync] Cannot open doc - not connected or no URI');
      return;
    }

    if (!isInitialized) {
      console.log('[LSP DocumentSync] Cannot open doc - not initialized yet');
      return;
    }

    if (openedFilesRef.current.has(effectiveUri)) {
      console.log('[LSP DocumentSync] File already opened:', effectiveUri);
      return;
    }

    console.log(`[LSP DocumentSync] 📤 Opening document: ${effectiveUri}`);
    versionRef.current = 1;

    sendDidOpen(ws, effectiveUri, text, versionRef.current);
    openedFilesRef.current.add(effectiveUri);
    markUriOpen(effectiveUri);
  }, [wsRef, isInitialized]);

  // Change text document
  const changeTextDocument = useCallback((text: string, uri?: string) => {
    const ws = wsRef.current;
    const effectiveUri = uri || currentFileUriRef.current;

    if (!ws || ws.readyState !== WebSocket.OPEN || !effectiveUri) {
      return;
    }

    if (!isInitialized) {
      return;
    }

    if (!openedFilesRef.current.has(effectiveUri)) {
      return;
    }

    versionRef.current += 1;
    console.log(`[LSP DocumentSync] 📤 Sending change for ${effectiveUri}, version ${versionRef.current}`);

    sendDidChange(ws, effectiveUri, text, versionRef.current);
  }, [wsRef, isInitialized]);

  // Close text document
  const closeTextDocument = useCallback((uri?: string) => {
    const ws = wsRef.current;
    const effectiveUri = uri || currentFileUriRef.current;

    if (!openedFilesRef.current.has(effectiveUri)) {
      return;
    }

    // Tell the server the document is closed (best effort: if the socket is
    // already gone the server will drop its own state anyway).
    if (ws && ws.readyState === WebSocket.OPEN) {
      console.log(`[LSP DocumentSync] 📤 Closing document: ${effectiveUri}`);
      sendDidClose(ws, effectiveUri);
    }

    openedFilesRef.current.delete(effectiveUri);
    markUriClosed(effectiveUri);
  }, [wsRef]);

  return {
    openTextDocument,
    changeTextDocument,
    closeTextDocument,
  };
}
