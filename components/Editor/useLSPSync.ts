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
}

/**
 * Tracks the last content this hook handed to the LSP, keyed by document uri.
 *
 * A single shared string (the previous implementation) belongs to whichever
 * file was last open, so switching from file A to file B compared B's content
 * against A's snapshot and could skip a real change. Keeping one entry per uri
 * makes the "did this document actually change?" check correct for multi-file
 * sessions.
 *
 * Exported for testability.
 */
export interface ContentTracker {
  hasChanged(uri: string, content: string): boolean;
  lastContent(uri: string): string | undefined;
  reset(uri: string): void;
}

export function createContentTracker(): ContentTracker {
  const last = new Map<string, string>();

  return {
    hasChanged(uri, content) {
      if (last.get(uri) === content) {
        return false;
      }
      last.set(uri, content);
      return true;
    },
    lastContent: (uri) => last.get(uri),
    reset: (uri) => {
      last.delete(uri);
    },
  };
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
}: UseLSPSyncParams): void {
  const trackerRef = useRef<ContentTracker | null>(null);
  if (!trackerRef.current) {
    trackerRef.current = createContentTracker();
  }

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
    const tracker = trackerRef.current;

    // Only send if *this* document's content actually changed.
    if (!tracker || !tracker.hasChanged(fileUri, content)) {
      return;
    }

    // Invalidate inlay hints cache when content changes
    invalidateHintsCache();

    // Debounce changes to avoid flooding LSP
    const timeoutId = setTimeout(() => {
      changeTextDocument(content, fileUri);
    }, LSP_CHANGE_DEBOUNCE_MS);

    return () => clearTimeout(timeoutId);
  }, [isConnected, openFile, fileContents, changeTextDocument, fileUri]);
}
