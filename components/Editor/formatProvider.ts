/**
 * Format Provider for Monaco Editor
 * Enables Shift+Alt+F to format document using rustfmt
 */

import type { editor, languages, CancellationToken } from "monaco-editor";
import type { MonacoType } from "./types";

/**
 * Request formatting from LSP
 */
async function requestFormatting(uri: string): Promise<TextEdit[]> {
  const lspFn = window.lspFunctions;
  if (!lspFn?.requestFormatting) {
    return [];
  }

  try {
    const result = await lspFn.requestFormatting(uri);
    return (result as TextEdit[]) || [];
  } catch (error) {
    console.error("[Format] Error:", error);
    return [];
  }
}

/**
 * Convert LSP text edits to Monaco edits
 */
function convertToMonacoEdits(
  edits: TextEdit[]
): languages.TextEdit[] {
  return edits.map((edit) => ({
    range: {
      startLineNumber: edit.range.start.line + 1,
      startColumn: edit.range.start.character + 1,
      endLineNumber: edit.range.end.line + 1,
      endColumn: edit.range.end.character + 1,
    },
    text: edit.newText,
  }));
}

/**
 * Register the format provider for Rust
 * De-duplicated per Monaco instance by registerLanguageProviders
 */
export function registerFormatProvider(
  monaco: MonacoType
): { dispose: () => void } {
  const provider = monaco.languages.registerDocumentFormattingEditProvider(
    "rust",
    {
      provideDocumentFormattingEdits: async (
        model: editor.ITextModel,
        _options: languages.FormattingOptions,
        _token: CancellationToken
      ): Promise<languages.TextEdit[]> => {
        const uri = model.uri.toString();

        const edits = await requestFormatting(uri);

        if (edits.length === 0) {
          console.log("[Format] No edits returned from LSP");
          return [];
        }

        console.log(`[Format] Applying ${edits.length} edits`);
        return convertToMonacoEdits(edits);
      },
    }
  );

  console.log("[Editor] Format provider registered for Rust");
  return provider;
}

// LSP TextEdit interface
interface TextEdit {
  range: {
    start: { line: number; character: number };
    end: { line: number; character: number };
  };
  newText: string;
}
