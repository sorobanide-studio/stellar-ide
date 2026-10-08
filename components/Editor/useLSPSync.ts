/**
 * Hook for synchronizing editor content with LSP
 */

import { useEffect, useRef } from "react";
import { invalidateHintsCache } from "./inlayHints";
import { LSP_CHANGE_DEBOUNCE_MS } from "./constants";
import type { FileNode } from "./types";

interface UseLSPSyncParams {
  isConnected: boolean;
  openFile: FileNode | null;
  fileUri: string;
  fileContents: Map<string, string>;
  openTextDocument: (text: string, uri?: string) => void;
  changeTextDocument: (text: string, uri?: string) => void;
  closeTextDocument: (uri?: string) => void;
}

/**
 * Hook to sync editor content with LSP server
 * Handles opening files and debounced content changes
 */
export function useLSPSync({
  isConnected,
  openFile,
  fileUri,
  fileContents,
  openTextDocument,
  changeTextDocument,
  closeTextDocument,
}: UseLSPSyncParams): void {
  const lastContentRef = useRef<string>("");
  const openedUriRef = useRef<string>("");

  // Close the previously open document (and the last one on unmount) so the
  // language server does not accumulate open documents whose diagnostics then
  // leak onto other files. Declared before the "open" effect so the didClose
  // is emitted before the new didOpen.
  useEffect(() => {
    if (!isConnected) {
      return;
    }

    const currentUri =
      openFile && openFile.name.endsWith(".rs") && fileUri ? fileUri : "";

    if (openedUriRef.current && openedUriRef.current !== currentUri) {
      closeTextDocument(openedUriRef.current);
      openedUriRef.current = "";
    }

    if (currentUri) {
      openedUriRef.current = currentUri;
    }
  }, [isConnected, openFile, fileUri, closeTextDocument]);

  useEffect(() => {
    return () => {
      if (openedUriRef.current) {
        closeTextDocument(openedUriRef.current);
        openedUriRef.current = "";
      }
    };
  }, [closeTextDocument]);

  // Open file in LSP when connected (only for Rust files)
  useEffect(() => {
    if (
      isConnected &&
      openFile &&
      openFile.name.endsWith(".rs") &&
      fileContents.has(openFile.path) &&
      fileUri
    ) {
      const content = fileContents.get(openFile.path) || "";
      console.log(`[LSP Sync] Opening Rust file: ${fileUri}`);
      openTextDocument(content, fileUri);
    }
  }, [isConnected, openFile, fileContents, openTextDocument, fileUri]);

  // Sync content changes to LSP (debounced)
  useEffect(() => {
    if (!isConnected || !openFile || !openFile.name.endsWith(".rs") || !fileUri) {
      return;
    }

    const content = fileContents.get(openFile.path) || "";

    // Only send if content actually changed
    if (content === lastContentRef.current) {
      return;
    }

    lastContentRef.current = content;

    // Invalidate inlay hints cache when content changes
    invalidateHintsCache();

    // Debounce changes to avoid flooding LSP
    const timeoutId = setTimeout(() => {
      changeTextDocument(content, fileUri);
    }, LSP_CHANGE_DEBOUNCE_MS);

    return () => clearTimeout(timeoutId);
  }, [isConnected, openFile, fileContents, changeTextDocument, fileUri]);
}
