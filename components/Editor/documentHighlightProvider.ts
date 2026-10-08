/**
 * Document Highlight Provider for Monaco Editor
 * Highlights all occurrences of the symbol at the cursor position
 */

import type { editor, languages, Position, CancellationToken } from "monaco-editor";
import type { MonacoType } from "./types";

// Global state
let highlightProviderRegistered = false;

/**
 * Check if highlight provider is already registered
 */
export function isHighlightProviderRegistered(): boolean {
  return highlightProviderRegistered;
}

/**
 * Request document highlight from LSP
 */
async function requestDocumentHighlight(
  uri: string,
  position: { line: number; character: number },
  token?: CancellationToken
): Promise<DocumentHighlight[]> {
  const lspFn = window.lspFunctions;
  if (!lspFn?.requestDocumentHighlight) {
    return [];
  }

  try {
    const result = await lspFn.requestDocumentHighlight(uri, position, token);
    return result as DocumentHighlight[];
  } catch (error) {
    console.error("[DocumentHighlight] Error:", error);
    return [];
  }
}

/**
 * Convert LSP document highlights to Monaco highlights
 */
function convertToMonacoHighlights(
  highlights: DocumentHighlight[],
  monaco: MonacoType
): languages.DocumentHighlight[] {
  return highlights.map((highlight) => {
    const range = {
      startLineNumber: highlight.range.start.line + 1,
      startColumn: highlight.range.start.character + 1,
      endLineNumber: highlight.range.end.line + 1,
      endColumn: highlight.range.end.character + 1,
    };

    // DocumentHighlightKind: Text = 1, Read = 2, Write = 3
    let kind: languages.DocumentHighlightKind = monaco.languages.DocumentHighlightKind.Text;
    if (highlight.kind === 2) {
      kind = monaco.languages.DocumentHighlightKind.Read;
    } else if (highlight.kind === 3) {
      kind = monaco.languages.DocumentHighlightKind.Write;
    }

    return {
      range,
      kind,
    };
  });
}

/**
 * Register the document highlight provider for Rust
 * Only registers once globally
 */
export function registerDocumentHighlightProvider(
  monaco: MonacoType
): { dispose: () => void } | null {
  if (highlightProviderRegistered) {
    return null;
  }

  highlightProviderRegistered = true;

  const provider = monaco.languages.registerDocumentHighlightProvider("rust", {
    provideDocumentHighlights: async (
      model: editor.ITextModel,
      position: Position,
      token: CancellationToken
    ): Promise<languages.DocumentHighlight[] | null> => {
      const uri = model.uri.toString();

      // Convert Monaco position (1-based) to LSP position (0-based)
      const lspPosition = {
        line: position.lineNumber - 1,
        character: position.column - 1,
      };

      const highlights = await requestDocumentHighlight(uri, lspPosition, token);

      if (!highlights || highlights.length === 0) {
        return null;
      }

      return convertToMonacoHighlights(highlights, monaco);
    },
  });

  console.log("[Editor] Document highlight provider registered for Rust");
  return provider;
}

// LSP Document Highlight interface
interface DocumentHighlight {
  range: {
    start: { line: number; character: number };
    end: { line: number; character: number };
  };
  kind?: number; // DocumentHighlightKind: Text = 1, Read = 2, Write = 3
}
