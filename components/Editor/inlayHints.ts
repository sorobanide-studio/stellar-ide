/**
 * Inlay Hints Provider for Monaco Editor
 * Handles caching, throttling, and conversion of LSP inlay hints
 */

import type { editor } from "monaco-editor";
import type { MonacoType, InlayHint, InlayHintsCache } from "./types";
import { HINTS_CACHE_TTL } from "./constants";

// Global state for inlay hints
let inlayHintsCache: InlayHintsCache | null = null;
let pendingHintsRequest: Promise<InlayHint[]> | null = null;
let pendingRequestUri: string | null = null;
let lastRequestTime = 0;
const REQUEST_THROTTLE_MS = 500; // Minimum time between requests

/**
 * Invalidate the inlay hints cache
 */
export function invalidateHintsCache(): void {
  inlayHintsCache = null;
  pendingHintsRequest = null;
  pendingRequestUri = null;
}

/**
 * Convert LSP inlay hints to Monaco format
 */
function convertHintsToMonaco(
  hints: InlayHint[],
  monaco: MonacoType,
  range: { startLineNumber: number; endLineNumber: number }
) {
  const seenPositions = new Set<string>();

  return hints
    .filter((hint) => {
      // Filter to requested range (Monaco is 1-based)
      const lineNum = hint.position.line + 1;
      if (lineNum < range.startLineNumber || lineNum > range.endLineNumber) {
        return false;
      }
      // Deduplicate by position
      const key = `${hint.position.line}:${hint.position.character}`;
      if (seenPositions.has(key)) {
        return false;
      }
      seenPositions.add(key);
      return true;
    })
    .map((hint) => {
      const label =
        typeof hint.label === "string"
          ? hint.label
          : hint.label.map((l) => l.value).join("");

      return {
        position: {
          lineNumber: hint.position.line + 1,
          column: hint.position.character + 1,
        },
        label,
        kind:
          hint.kind === 1
            ? monaco.languages.InlayHintKind.Type
            : monaco.languages.InlayHintKind.Parameter,
        paddingLeft: hint.paddingLeft ?? true,
        paddingRight: hint.paddingRight ?? false,
      };
    });
}

/**
 * Register the inlay hints provider for Rust
 * De-duplicated per Monaco instance by registerLanguageProviders
 */
export function registerInlayHintsProvider(
  monaco: MonacoType
): { dispose: () => void } {
  const provider = monaco.languages.registerInlayHintsProvider("rust", {
    provideInlayHints: async (
      model: editor.ITextModel,
      range: { startLineNumber: number; endLineNumber: number }
    ) => {
      // Get fresh function reference from window
      const lspFn = window.lspFunctions;
      if (!lspFn) {
        return { hints: [], dispose: () => {} };
      }

      const uri = model.uri.toString();
      const now = Date.now();

      // Check cache - return cached hints if still valid
      if (
        inlayHintsCache &&
        inlayHintsCache.uri === uri &&
        now - inlayHintsCache.timestamp < HINTS_CACHE_TTL
      ) {
        const cachedHints = convertHintsToMonaco(
          inlayHintsCache.hints,
          monaco,
          range
        );
        return { hints: cachedHints, dispose: () => {} };
      }

      // Throttle: skip if we just made a request
      if (now - lastRequestTime < REQUEST_THROTTLE_MS) {
        // Return empty while throttled - cache will be populated soon
        if (inlayHintsCache && inlayHintsCache.uri === uri) {
          const cachedHints = convertHintsToMonaco(
            inlayHintsCache.hints,
            monaco,
            range
          );
          return { hints: cachedHints, dispose: () => {} };
        }
        return { hints: [], dispose: () => {} };
      }

      // If there's already a pending request for the SAME URI, wait for it
      if (pendingHintsRequest && pendingRequestUri === uri) {
        try {
          const hints = await pendingHintsRequest;
          const monacoHints = convertHintsToMonaco(hints, monaco, range);
          return { hints: monacoHints, dispose: () => {} };
        } catch {
          return { hints: [], dispose: () => {} };
        }
      }

      // Make the request - only one at a time
      try {
        lastRequestTime = now;
        pendingRequestUri = uri;

        // Use the visible range Monaco provides (convert to 0-based for LSP)
        // This avoids line count mismatches between Monaco and rust-analyzer
        const startLine = Math.max(0, range.startLineNumber - 1);
        const endLine = Math.max(0, range.endLineNumber - 1);
        
        pendingHintsRequest = lspFn.requestInlayHints(uri, {
          startLine,
          endLine,
        });

        const hints = await pendingHintsRequest;
        pendingHintsRequest = null;
        pendingRequestUri = null;

        // Cache the results (for this range)
        inlayHintsCache = { uri, hints, timestamp: Date.now() };

        const monacoHints = convertHintsToMonaco(hints, monaco, range);
        return { hints: monacoHints, dispose: () => {} };
      } catch (error) {
        pendingHintsRequest = null;
        pendingRequestUri = null;
        console.error("[InlayHints] Error:", error);
        return { hints: [], dispose: () => {} };
      }
    },
  });

  console.log("[Editor] Inlay hints provider registered for Rust");
  return provider;
}
