/**
 * Reference Provider for Monaco Editor
 * Enables Shift+F12 to find all references to a symbol
 */

import type { editor, languages, Position, CancellationToken } from "monaco-editor";
import type { MonacoType } from "./types";

/**
 * Request references from LSP
 */
async function requestReferencesInfo(
  uri: string,
  position: { line: number; character: number },
  includeDeclaration: boolean = true,
  token?: CancellationToken
): Promise<LocationResult[]> {
  const lspFn = window.lspFunctions;
  if (!lspFn?.requestReferences) {
    return [];
  }

  try {
    const result = await lspFn.requestReferences(uri, position, {
      includeDeclaration,
    }, token);
    // LSP returns Location[]
    if (!result) return [];
    return Array.isArray(result) ? result : [];
  } catch (error) {
    console.error("[Reference] Error:", error);
    return [];
  }
}

/**
 * Convert LSP location to Monaco location
 */
function convertToMonacoLocation(
  location: LocationResult
): languages.Location {
  // Handle LocationLink format (has targetUri)
  if ("targetUri" in location && location.targetUri) {
    const targetRange = location.targetSelectionRange || location.targetRange;
    return {
      uri: { toString: () => location.targetUri } as languages.Uri,
      range: {
        startLineNumber: targetRange.start.line + 1,
        startColumn: targetRange.start.character + 1,
        endLineNumber: targetRange.end.line + 1,
        endColumn: targetRange.end.character + 1,
      },
    };
  }

  // Handle Location format (has uri)
  if ("uri" in location && location.uri) {
    return {
      uri: { toString: () => location.uri } as languages.Uri,
      range: {
        startLineNumber: location.range.start.line + 1,
        startColumn: location.range.start.character + 1,
        endLineNumber: location.range.end.line + 1,
        endColumn: location.range.end.character + 1,
      },
    };
  }

  // Fallback - should not happen
  throw new Error("Invalid location format");
}

/**
 * Register the reference provider for Rust
 * De-duplicated per Monaco instance by registerLanguageProviders
 * Monaco automatically handles Shift+F12 keyboard shortcut
 */
export function registerReferenceProvider(
  monaco: MonacoType
): { dispose: () => void } {
  const provider = monaco.languages.registerReferenceProvider("rust", {
    provideReferences: async (
      model: editor.ITextModel,
      position: Position,
      context: languages.ReferenceContext,
      token: CancellationToken
    ): Promise<languages.Location[] | null> => {
      const uri = model.uri.toString();

      // Convert Monaco position (1-based) to LSP position (0-based)
      const lspPosition = {
        line: position.lineNumber - 1,
        character: position.column - 1,
      };

      // Include declaration if context says so (usually true for "Find All References")
      const includeDeclaration = context.includeDeclaration;

      const locations = await requestReferencesInfo(
        uri,
        lspPosition,
        includeDeclaration,
        token
      );

      if (locations.length === 0) {
        console.log("[Reference] No references found");
        return null;
      }

      console.log(`[Reference] Found ${locations.length} references`);

      // Convert all locations to Monaco format
      const monacoLocations = locations
        .map((loc) => {
          try {
            return convertToMonacoLocation(loc);
          } catch (error) {
            console.error("[Reference] Failed to convert location:", error);
            return null;
          }
        })
        .filter((loc): loc is languages.Location => loc !== null);

      return monacoLocations.length > 0 ? monacoLocations : null;
    },
  });

  console.log("[Editor] Reference provider registered for Rust (Shift+F12)");
  return provider;
}

// LSP Location interfaces
interface Range {
  start: { line: number; character: number };
  end: { line: number; character: number };
}

interface Location {
  uri: string;
  range: Range;
}

interface LocationLink {
  originSelectionRange?: Range;
  targetUri: string;
  targetRange: Range;
  targetSelectionRange?: Range;
}

type LocationResult = Location | LocationLink;
