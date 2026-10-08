/**
 * LSP Document Sync Hook
 * Handles document synchronization (didOpen, didChange)
 */

import { useCallback, useRef } from 'react';
import { sendDidOpen, sendDidChange } from '../requests';

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
 * Per-document version bookkeeping.
 *
 * The LSP specification requires each document's `version` to increase
 * monotonically on its own, independent of every other document, so a single
 * global counter is wrong as soon as more than one file is open. This store
 * keeps one counter and one open-flag per uri, and forgets a document when it
 * is closed so a re-open starts a fresh sequence.
 *
 * Exported for testability.
 */
export interface DocumentVersionStore {
  isOpen(uri: string): boolean;
  open(uri: string, startVersion?: number): number;
  change(uri: string): number;
  close(uri: string): void;
  versionOf(uri: string): number | undefined;
}

export function createDocumentVersionStore(): DocumentVersionStore {
  const opened = new Set<string>();
  const versions = new Map<string, number>();

  return {
    isOpen: (uri) => opened.has(uri),
    open(uri, startVersion = 1) {
      opened.add(uri);
      versions.set(uri, startVersion);
      return startVersion;
    },
    change(uri) {
      const next = (versions.get(uri) ?? 0) + 1;
      versions.set(uri, next);
      return next;
    },
    close(uri) {
      opened.delete(uri);
      versions.delete(uri);
    },
    versionOf: (uri) => versions.get(uri),
  };
}

/**
 * Hook to manage document synchronization with LSP
 */
export function useLSPDocumentSync({
  wsRef,
  isInitialized,
  currentFileUri,
}: UseLSPDocumentSyncProps): UseLSPDocumentSyncReturn {
  const storeRef = useRef<DocumentVersionStore | null>(null);
  if (!storeRef.current) {
    storeRef.current = createDocumentVersionStore();
  }
  const currentFileUriRef = useRef<string>('');

  // Update current file URI ref
  currentFileUriRef.current = currentFileUri;

  // Open text document
  const openTextDocument = useCallback((text: string, uri?: string) => {
    const ws = wsRef.current;
    const effectiveUri = uri || currentFileUriRef.current;
    const store = storeRef.current;

    if (!ws || ws.readyState !== WebSocket.OPEN || !effectiveUri) {
      console.log('[LSP DocumentSync] Cannot open doc - not connected or no URI');
      return;
    }

    if (!isInitialized) {
      console.log('[LSP DocumentSync] Cannot open doc - not initialized yet');
      return;
    }

    if (!store || store.isOpen(effectiveUri)) {
      console.log('[LSP DocumentSync] File already opened:', effectiveUri);
      return;
    }

    console.log(`[LSP DocumentSync] 📤 Opening document: ${effectiveUri}`);
    const version = store.open(effectiveUri, 1);

    sendDidOpen(ws, effectiveUri, text, version);
  }, [wsRef, isInitialized]);

  // Change text document
  const changeTextDocument = useCallback((text: string, uri?: string) => {
    const ws = wsRef.current;
    const effectiveUri = uri || currentFileUriRef.current;
    const store = storeRef.current;

    if (!ws || ws.readyState !== WebSocket.OPEN || !effectiveUri) {
      return;
    }

    if (!isInitialized) {
      return;
    }

    if (!store || !store.isOpen(effectiveUri)) {
      return;
    }

    const version = store.change(effectiveUri);
    console.log(`[LSP DocumentSync] 📤 Sending change for ${effectiveUri}, version ${version}`);

    sendDidChange(ws, effectiveUri, text, version);
  }, [wsRef, isInitialized]);

  // Forget a closed document so re-opening it starts a fresh version sequence.
  const closeTextDocument = useCallback((uri?: string) => {
    const effectiveUri = uri || currentFileUriRef.current;
    if (!effectiveUri) {
      return;
    }
    storeRef.current?.close(effectiveUri);
  }, []);

  return {
    openTextDocument,
    changeTextDocument,
    closeTextDocument,
  };
}
