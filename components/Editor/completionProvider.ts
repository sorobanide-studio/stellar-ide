/**
 * Completion Provider for Monaco Editor
 * Handles auto-complete suggestions from rust-analyzer
 */

import type { editor, languages, Position, CancellationToken } from "monaco-editor";
import type { MonacoType } from "./types";

/**
 * Request completion from LSP
 */
async function requestCompletion(
  uri: string,
  position: { line: number; character: number }
): Promise<CompletionItem[]> {
  const lspFn = window.lspFunctions;
  if (!lspFn?.requestCompletion) {
    return [];
  }

  try {
    const items = await lspFn.requestCompletion(uri, position);
    return items as CompletionItem[];
  } catch (error) {
    console.error("[Completion] Error:", error);
    return [];
  }
}

/**
 * Convert LSP completion kind to Monaco completion kind
 */
function convertCompletionKind(
  kind: number | undefined,
  monaco: MonacoType
): languages.CompletionItemKind {
  // LSP CompletionItemKind mapping to Monaco
  const kindMap: Record<number, languages.CompletionItemKind> = {
    1: monaco.languages.CompletionItemKind.Text,
    2: monaco.languages.CompletionItemKind.Method,
    3: monaco.languages.CompletionItemKind.Function,
    4: monaco.languages.CompletionItemKind.Constructor,
    5: monaco.languages.CompletionItemKind.Field,
    6: monaco.languages.CompletionItemKind.Variable,
    7: monaco.languages.CompletionItemKind.Class,
    8: monaco.languages.CompletionItemKind.Interface,
    9: monaco.languages.CompletionItemKind.Module,
    10: monaco.languages.CompletionItemKind.Property,
    11: monaco.languages.CompletionItemKind.Unit,
    12: monaco.languages.CompletionItemKind.Value,
    13: monaco.languages.CompletionItemKind.Enum,
    14: monaco.languages.CompletionItemKind.Keyword,
    15: monaco.languages.CompletionItemKind.Snippet,
    16: monaco.languages.CompletionItemKind.Color,
    17: monaco.languages.CompletionItemKind.File,
    18: monaco.languages.CompletionItemKind.Reference,
    19: monaco.languages.CompletionItemKind.Folder,
    20: monaco.languages.CompletionItemKind.EnumMember,
    21: monaco.languages.CompletionItemKind.Constant,
    22: monaco.languages.CompletionItemKind.Struct,
    23: monaco.languages.CompletionItemKind.Event,
    24: monaco.languages.CompletionItemKind.Operator,
    25: monaco.languages.CompletionItemKind.TypeParameter,
  };

  return kindMap[kind || 1] || monaco.languages.CompletionItemKind.Text;
}

/**
 * Convert LSP completion items to Monaco format
 */
function convertCompletionItems(
  items: CompletionItem[],
  monaco: MonacoType,
  range: languages.Range
): languages.CompletionItem[] {
  return items.map((item, index) => {
    // Handle insertText vs textEdit
    let insertText = item.insertText || item.label;
    
    // Handle snippet format
    const insertTextRules = item.insertTextFormat === 2
      ? monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet
      : undefined;

    return {
      label: item.label,
      kind: convertCompletionKind(item.kind, monaco),
      insertText,
      insertTextRules,
      detail: item.detail,
      documentation: item.documentation
        ? typeof item.documentation === "string"
          ? item.documentation
          : item.documentation.value
        : undefined,
      sortText: item.sortText || String(index).padStart(5, "0"),
      filterText: item.filterText || item.label,
      range,
    };
  });
}

/**
 * Register the completion provider for Rust
 * De-duplicated per Monaco instance by registerLanguageProviders
 */
export function registerCompletionProvider(
  monaco: MonacoType
): { dispose: () => void } {
  const provider = monaco.languages.registerCompletionItemProvider("rust", {
    triggerCharacters: [".", ":", "<", '"', "'", "/"],

    provideCompletionItems: async (
      model: editor.ITextModel,
      position: Position,
      _context: languages.CompletionContext,
      _token: CancellationToken
    ): Promise<languages.CompletionList> => {
      const uri = model.uri.toString();

      // Convert Monaco position (1-based) to LSP position (0-based)
      const lspPosition = {
        line: position.lineNumber - 1,
        character: position.column - 1,
      };

      const items = await requestCompletion(uri, lspPosition);

      if (items.length === 0) {
        return { suggestions: [] };
      }

      // Calculate the word range for replacement
      const word = model.getWordUntilPosition(position);
      const range: languages.Range = {
        startLineNumber: position.lineNumber,
        startColumn: word.startColumn,
        endLineNumber: position.lineNumber,
        endColumn: word.endColumn,
      };

      const suggestions = convertCompletionItems(items, monaco, range);

      return { suggestions };
    },
  });

  console.log("[Editor] Completion provider registered for Rust");
  return provider;
}

// LSP Completion Item interface
interface CompletionItem {
  label: string;
  kind?: number;
  detail?: string;
  documentation?: string | { kind: string; value: string };
  insertText?: string;
  insertTextFormat?: number; // 1 = PlainText, 2 = Snippet
  sortText?: string;
  filterText?: string;
  textEdit?: {
    range: { start: { line: number; character: number }; end: { line: number; character: number } };
    newText: string;
  };
}
