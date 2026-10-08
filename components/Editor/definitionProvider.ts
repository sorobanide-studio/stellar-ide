/**
 * Definition Provider for Monaco Editor
 * Enables Cmd+Click / F12 to jump to definitions
 */

import type { editor, languages, Position, CancellationToken } from "monaco-editor";
import type { MonacoType } from "./types";

/**
 * Request definition from LSP
 */
async function requestDefinitionInfo(
  uri: string,
  position: { line: number; character: number }
): Promise<LocationResult[]> {
  const lspFn = window.lspFunctions;
  if (!lspFn?.requestDefinition) {
    return [];
  }

  try {
    const result = await lspFn.requestDefinition(uri, position);
    // LSP can return Location, Location[], or LocationLink[]
    if (!result) return [];
    return Array.isArray(result) ? result : [result];
  } catch (error) {
    console.error("[Definition] Error:", error);
    return [];
  }
}

/**
 * Convert LSP location to Monaco definition
 */
function convertToMonacoDefinition(
  location: LocationResult
): languages.Definition {
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
    } as languages.Location;
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
    } as languages.Location;
  }

  return null as unknown as languages.Definition;
}

/**
 * Register the definition provider for Rust
 * De-duplicated per Monaco instance by registerLanguageProviders
 */
export function registerDefinitionProvider(
  monaco: MonacoType
): { dispose: () => void } {
  const provider = monaco.languages.registerDefinitionProvider("rust", {
    provideDefinition: async (
      model: editor.ITextModel,
      position: Position,
      _token: CancellationToken
    ): Promise<languages.Definition | null> => {
      const uri = model.uri.toString();

      // Convert Monaco position (1-based) to LSP position (0-based)
      const lspPosition = {
        line: position.lineNumber - 1,
        character: position.column - 1,
      };

      const locations = await requestDefinitionInfo(uri, lspPosition);

      if (locations.length === 0) {
        return null;
      }

      // Single location
      if (locations.length === 1) {
        return convertToMonacoDefinition(locations[0]);
      }

      // Multiple locations - return array
      return locations
        .map(convertToMonacoDefinition)
        .filter(Boolean) as languages.Location[];
    },
  });

  console.log("[Editor] Definition provider registered for Rust");
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
