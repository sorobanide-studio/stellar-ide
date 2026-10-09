/**
 * Code Action Provider for Monaco Editor
 * Enables quick fixes and code actions from rust-analyzer
 * Shows lightbulb icon on errors/warnings and provides fixes
 */

import type { editor, languages, Range, CancellationToken } from "monaco-editor";
import type { MonacoType } from "./types";

/**
 * Request code actions from LSP
 */
async function requestCodeActions(
  uri: string,
  range: { start: { line: number; character: number }; end: { line: number; character: number } },
  context: { diagnostics: Array<{ range: { start: { line: number; character: number }; end: { line: number; character: number } }; severity: number; code?: string | number; message: string }> },
  token?: CancellationToken
): Promise<CodeAction[]> {
  const lspFn = window.lspFunctions;
  if (!lspFn?.requestCodeAction) {
    return [];
  }

  try {
    const result = await lspFn.requestCodeAction(uri, range, context, token);
    return (result as CodeAction[]) || [];
  } catch (error) {
    console.error("[CodeAction] Error:", error);
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
 * Register the code action provider for Rust
 * De-duplicated per Monaco instance by registerLanguageProviders
 */
export function registerCodeActionProvider(
  monaco: MonacoType
): { dispose: () => void } {
  const provider = monaco.languages.registerCodeActionProvider("rust", {
    provideCodeActions: async (
      model: editor.ITextModel,
      range: Range,
      context: languages.CodeActionContext,
      token: CancellationToken
    ): Promise<languages.CodeActionList | null> => {
      const uri = model.uri.toString();

      // Convert Monaco range (1-based) to LSP range (0-based)
      const lspRange = {
        start: {
          line: range.startLineNumber - 1,
          character: range.startColumn - 1,
        },
        end: {
          line: range.endLineNumber - 1,
          character: range.endColumn - 1,
        },
      };

      // Convert Monaco markers to LSP diagnostics format
      const diagnostics = (context.markers || []).map((marker) => ({
        range: {
          start: {
            line: marker.startLineNumber - 1,
            character: marker.startColumn - 1,
          },
          end: {
            line: marker.endLineNumber - 1,
            character: marker.endColumn - 1,
          },
        },
        severity: marker.severity, // Monaco: 8=Error, 4=Warning, 2=Info, 1=Hint
        code: undefined, // Monaco markers don't have code
        message: marker.message,
      }));

      const lspContext = { diagnostics };

      const actions = await requestCodeActions(uri, lspRange, lspContext, token);

      if (actions.length === 0) {
        return { actions: [], dispose: () => {} };
      }

      // Convert LSP code actions to Monaco format
      const monacoActions: languages.CodeAction[] = actions.map((action) => {
        // Convert edits for the current file
        const currentFileEdits = action.edit?.changes?.[uri] || [];
        const monacoEdits = currentFileEdits.length > 0 
          ? convertToMonacoEdits(currentFileEdits).map((edit) => ({
              resource: model.uri,
              versionId: model.getVersionId(),
              textEdit: edit,
            }))
          : [];

        const monacoAction: languages.CodeAction = {
          title: action.title,
          kind: action.kind || "quickfix",
          diagnostics: action.diagnostics?.map((diag) => ({
            startLineNumber: diag.range.start.line + 1,
            startColumn: diag.range.start.character + 1,
            endLineNumber: diag.range.end.line + 1,
            endColumn: diag.range.end.character + 1,
            message: diag.message,
            severity: diag.severity === 1 ? 8 : diag.severity === 2 ? 4 : 2, // Convert LSP to Monaco severity
            code: diag.code?.toString(),
          })),
          edit: monacoEdits.length > 0
            ? {
                edits: monacoEdits,
              }
            : undefined,
          command: action.command
            ? {
                id: action.command.command,
                title: action.command.title,
                arguments: action.command.arguments,
              }
            : undefined,
          isPreferred: action.isPreferred || false,
        };

        return monacoAction;
      });

      console.log(`[CodeAction] Found ${monacoActions.length} code actions`);
      return { actions: monacoActions, dispose: () => {} };
    },
  });

  console.log("[Editor] Code action provider registered for Rust");
  return provider;
}

// LSP CodeAction interface
interface CodeAction {
  title: string;
  kind?: string;
  diagnostics?: Array<{
    range: { start: { line: number; character: number }; end: { line: number; character: number } };
    severity: number;
    code?: string | number;
    message: string;
  }>;
  edit?: {
    changes?: Record<string, TextEdit[]>;
  };
  command?: {
    command: string;
    title: string;
    arguments?: unknown[];
  };
  isPreferred?: boolean;
}

// LSP TextEdit interface
interface TextEdit {
  range: {
    start: { line: number; character: number };
    end: { line: number; character: number };
  };
  newText: string;
}
