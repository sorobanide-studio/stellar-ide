/**
 * Hover Provider for Monaco Editor
 * Shows type information and documentation on hover
 */

import type { editor, languages, Position, CancellationToken } from "monaco-editor";
import type { MonacoType } from "./types";

/**
 * Request hover info from LSP
 */
async function requestHoverInfo(
  uri: string,
  position: { line: number; character: number },
  token?: CancellationToken
): Promise<HoverResult | null> {
  const lspFn = window.lspFunctions;
  if (!lspFn?.requestHover) {
    return null;
  }

  try {
    const result = await lspFn.requestHover(uri, position, token);
    return result as HoverResult | null;
  } catch (error) {
    console.error("[Hover] Error:", error);
    return null;
  }
}

/**
 * Convert LSP hover content to Monaco markdown
 */
function convertHoverContent(hover: HoverResult): languages.IMarkdownString[] {
  if (!hover || !hover.contents) {
    return [];
  }

  const contents = hover.contents;

  // Handle different content formats from LSP
  if (typeof contents === "string") {
    return [{ value: contents }];
  }

  if (Array.isArray(contents)) {
    return contents.map((item) => {
      if (typeof item === "string") {
        return { value: item };
      }
      // MarkedString with language
      if ("language" in item && "value" in item) {
        return { value: `\`\`\`${item.language}\n${item.value}\n\`\`\`` };
      }
      // MarkupContent
      if ("kind" in item && "value" in item) {
        return { value: item.value };
      }
      return { value: String(item) };
    });
  }

  // MarkupContent object
  if ("kind" in contents && "value" in contents) {
    return [{ value: contents.value }];
  }

  // MarkedString with language
  if ("language" in contents && "value" in contents) {
    return [{ value: `\`\`\`${contents.language}\n${contents.value}\n\`\`\`` }];
  }

  return [];
}

/**
 * Register the hover provider for Rust
 * De-duplicated per Monaco instance by registerLanguageProviders
 */
export function registerHoverProvider(
  monaco: MonacoType
): { dispose: () => void } {
  const provider = monaco.languages.registerHoverProvider("rust", {
    provideHover: async (
      model: editor.ITextModel,
      position: Position,
      token: CancellationToken
    ): Promise<languages.Hover | null> => {
      const uri = model.uri.toString();

      // Convert Monaco position (1-based) to LSP position (0-based)
      const lspPosition = {
        line: position.lineNumber - 1,
        character: position.column - 1,
      };

      const hover = await requestHoverInfo(uri, lspPosition, token);

      if (!hover) {
        return null;
      }

      const contents = convertHoverContent(hover);

      if (contents.length === 0) {
        return null;
      }

      // Build range if provided by LSP
      let range: languages.IRange | undefined;
      if (hover.range) {
        range = {
          startLineNumber: hover.range.start.line + 1,
          startColumn: hover.range.start.character + 1,
          endLineNumber: hover.range.end.line + 1,
          endColumn: hover.range.end.character + 1,
        };
      }

      return { contents, range };
    },
  });

  console.log("[Editor] Hover provider registered for Rust");
  return provider;
}

// LSP Hover result interface
interface HoverResult {
  contents:
    | string
    | MarkedString
    | MarkedString[]
    | MarkupContent;
  range?: {
    start: { line: number; character: number };
    end: { line: number; character: number };
  };
}

interface MarkedString {
  language: string;
  value: string;
}

interface MarkupContent {
  kind: "plaintext" | "markdown";
  value: string;
}
