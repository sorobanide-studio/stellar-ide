/**
 * Rename Provider for Monaco Editor
 * Enables F2 to rename symbols across files
 */

import type { editor, languages, Position, CancellationToken, Uri } from "monaco-editor";
import type { MonacoType } from "./types";

/**
 * Request prepare rename from LSP
 */
async function requestPrepareRenameInfo(
  uri: string,
  position: { line: number; character: number }
): Promise<{ range: { start: { line: number; character: number }; end: { line: number; character: number } }; placeholder?: string } | null> {
  const lspFn = window.lspFunctions;
  if (!lspFn?.requestPrepareRename) {
    return null;
  }

  try {
    const result = await lspFn.requestPrepareRename(uri, position);
    return result;
  } catch (error) {
    console.error("[Rename] Prepare error:", error);
    return null;
  }
}

// Type for rename result
interface RenameResult {
  changes?: Record<string, Array<{
    range: {
      start: { line: number; character: number };
      end: { line: number; character: number };
    };
    newText: string;
  }>>;
}

/**
 * Request rename from LSP
 */
async function requestRenameInfo(
  uri: string,
  position: { line: number; character: number },
  newName: string
): Promise<RenameResult | null> {
  const lspFn = window.lspFunctions;
  if (!lspFn?.requestRename) {
    return null;
  }

  try {
    const result = await lspFn.requestRename(uri, position, newName);
    return result as RenameResult | null;
  } catch (error) {
    console.error("[Rename] Error:", error);
    return null;
  }
}

/**
 * Convert LSP text edits to Monaco workspace edits
 */
function convertToMonacoWorkspaceEdit(
  changes: Record<string, Array<{ range: { start: { line: number; character: number }; end: { line: number; character: number } }; newText: string }>>,
  monaco: MonacoType
): languages.WorkspaceEdit {
  const edits: languages.IWorkspaceTextEdit[] = [];

  for (const [fileUri, textEdits] of Object.entries(changes)) {
    // Convert LSP file:// URI to Monaco URI
    let uri: Uri;
    try {
      if (fileUri.startsWith('file://')) {
        // Extract the path from file:// URI (remove file:// prefix)
        // Handle both file:///path and file://path formats
        const path = fileUri.replace(/^file:\/\/+/, '');
        uri = monaco.Uri.file(path);
      } else {
        // Fallback to parse if not a file:// URI
        uri = monaco.Uri.parse(fileUri);
      }
    } catch (error) {
      console.error(`[Rename] Failed to create URI for: ${fileUri}`, error);
      continue;
    }
    
    for (const edit of textEdits) {
      edits.push({
        resource: uri,
        versionId: undefined, // We'll let Monaco handle versioning
        textEdit: {
          range: {
            startLineNumber: edit.range.start.line + 1,
            startColumn: edit.range.start.character + 1,
            endLineNumber: edit.range.end.line + 1,
            endColumn: edit.range.end.character + 1,
          },
          text: edit.newText,
        },
      });
    }
  }

  return { edits };
}

/**
 * Register the rename provider for Rust
 * De-duplicated per Monaco instance by registerLanguageProviders
 * Monaco automatically handles F2 keyboard shortcut
 */
export function registerRenameProvider(
  monaco: MonacoType
): { dispose: () => void } {
  const provider = monaco.languages.registerRenameProvider("rust", {
    provideRenameEdits: async (
      model: editor.ITextModel,
      position: Position,
      newName: string,
      _token: CancellationToken
    ): Promise<languages.WorkspaceEdit | null> => {
      const uri = model.uri.toString();

      // Convert Monaco position (1-based) to LSP position (0-based)
      const lspPosition = {
        line: position.lineNumber - 1,
        character: position.column - 1,
      };

      // First, check if rename is possible (prepareRename)
      const prepareResult = await requestPrepareRenameInfo(uri, lspPosition);
      
      if (!prepareResult) {
        console.log("[Rename] Rename not possible at this location");
        return null;
      }

      console.log(`[Rename] Preparing to rename to: ${newName}`);

      // Perform the actual rename
      const renameResult = await requestRenameInfo(uri, lspPosition, newName);

      if (!renameResult || !renameResult.changes) {
        console.log("[Rename] No changes returned from LSP");
        return null;
      }

      const fileCount = Object.keys(renameResult.changes).length;
      const editCount = Object.values(renameResult.changes).reduce(
        (sum, edits) => sum + edits.length,
        0
      );

      console.log(`[Rename] Renaming across ${fileCount} files with ${editCount} edits`);

      // Convert LSP workspace edit to Monaco format
      const workspaceEdit = convertToMonacoWorkspaceEdit(
        renameResult.changes,
        monaco
      );

      return workspaceEdit;
    },
  });

  console.log("[Editor] Rename provider registered for Rust (F2)");
  return provider;
}
