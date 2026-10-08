/**
 * Document Symbol Provider for Monaco Editor
 * Enables document symbols (outline view) for Rust files
 */

import type { editor, languages, CancellationToken } from "monaco-editor";
import type { MonacoType } from "./types";
import type { DocumentSymbol } from "../../lib/lsp/requests";

/**
 * Request document symbols from LSP
 */
async function requestDocumentSymbolsInfo(
  uri: string
): Promise<DocumentSymbol[]> {
  const lspFn = window.lspFunctions;
  if (!lspFn?.requestDocumentSymbols) {
    return [];
  }

  try {
    const result = await lspFn.requestDocumentSymbols(uri);
    return Array.isArray(result) ? result : [];
  } catch (error) {
    console.error("[DocumentSymbol] Error:", error);
    return [];
  }
}

/**
 * Convert LSP DocumentSymbol to Monaco DocumentSymbol
 */
function convertToMonacoDocumentSymbol(
  symbol: DocumentSymbol
): languages.DocumentSymbol {
  return {
    name: symbol.name,
    detail: symbol.detail || "",
    kind: symbol.kind,
    deprecated: symbol.deprecated || false,
    range: {
      startLineNumber: symbol.range.start.line + 1,
      startColumn: symbol.range.start.character + 1,
      endLineNumber: symbol.range.end.line + 1,
      endColumn: symbol.range.end.character + 1,
    },
    selectionRange: {
      startLineNumber: symbol.selectionRange.start.line + 1,
      startColumn: symbol.selectionRange.start.character + 1,
      endLineNumber: symbol.selectionRange.end.line + 1,
      endColumn: symbol.selectionRange.end.character + 1,
    },
    children: symbol.children
      ? symbol.children.map(convertToMonacoDocumentSymbol)
      : undefined,
    tags: [],
  };
}

/**
 * Register the document symbol provider for Rust
 * De-duplicated per Monaco instance by registerLanguageProviders
 */
export function registerDocumentSymbolProvider(
  monaco: MonacoType
): { dispose: () => void } {
  const provider = monaco.languages.registerDocumentSymbolProvider("rust", {
    provideDocumentSymbols: async (
      model: editor.ITextModel,
      _token: CancellationToken
    ): Promise<languages.DocumentSymbol[]> => {
      const uri = model.uri.toString();

      const symbols = await requestDocumentSymbolsInfo(uri);

      if (symbols.length === 0) {
        return [];
      }

      return symbols.map(convertToMonacoDocumentSymbol);
    },
  });

  console.log("[Editor] Document symbol provider registered for Rust");
  return provider;
}
