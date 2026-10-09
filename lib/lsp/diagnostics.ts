/**
 * LSP Diagnostics Handler
 * Handles converting and applying diagnostics to Monaco editor
 */

import { Diagnostic, MonacoMarker, WindowWithMonaco, MonacoModel } from './types';

/**
 * Mapping from LSP DiagnosticSeverity to Monaco MarkerSeverity:
 *
 *   LSP  1 Error        -> Monaco 8 Error
 *   LSP  2 Warning      -> Monaco 4 Warning
 *   LSP  3 Information  -> Monaco 2 Info
 *   LSP  4 Hint         -> Monaco 1 Hint
 *
 * A diagnostic that omits `severity` uses the LSP default of 1 (Error), which
 * is Monaco 8.
 */
const LSP_SEVERITY_TO_MONACO: Record<number, number> = {
  1: 8, // Error
  2: 4, // Warning
  3: 2, // Information
  4: 1, // Hint
};

const DEFAULT_MONACO_SEVERITY = 8;
 * URIs the client has closed via `textDocument/didClose`.
 *
 * Diagnostics that arrive for a closed document are stale: applying them paints
 * markers for a file the user is no longer editing onto whichever model
 * happens to match. They are dropped until the document is re-opened.
 */
const closedUris = new Set<string>();

/** Mark a document as (re)opened so its diagnostics are applied again. */
export function markUriOpen(uri: string): void {
  closedUris.delete(uri);
}

/** Mark a document as closed so any late diagnostics for it are dropped. */
export function markUriClosed(uri: string): void {
  closedUris.add(uri);
}

/** @returns true when the client has closed (and not re-opened) the document. */
export function isUriClosed(uri: string): boolean {
  return closedUris.has(uri);
}

/**
 * Convert LSP diagnostics to Monaco markers
 * LSP severity: 1=Error, 2=Warning, 3=Information, 4=Hint
 * LSP severity: 1=Error, 2=Warning, 3=Info, 4=Hint
 * Monaco severity: 8=Error, 4=Warning, 2=Info, 1=Hint
 */
const MONACO_SEVERITY: Record<number, number> = {
  1: 8,
  2: 4,
  3: 2,
  4: 1,
};

/**
 * Convert LSP diagnostics to Monaco markers
 */
export function convertToMonacoMarkers(diagnostics: Diagnostic[]): MonacoMarker[] {
  return diagnostics.map((diag) => ({
    startLineNumber: diag.range.start.line + 1,
    startColumn: diag.range.start.character + 1,
    endLineNumber: diag.range.end.line + 1,
    endColumn: diag.range.end.character + 1,
    message: diag.message,
    severity: LSP_SEVERITY_TO_MONACO[diag.severity] ?? DEFAULT_MONACO_SEVERITY,
    severity: MONACO_SEVERITY[diag.severity] ?? 2,
  }));
}

/**
 * Split a `file://` URI into its non-empty path segments.
 */
function uriPathSegments(uri: string): string[] {
  return uri.replace(/^file:\/\//, '').split('/').filter(Boolean);
}

/**
 * Find matching Monaco model for a given URI.
 *
 * Matches on the full path first, then on a suffix/prefix path (which includes
 * the containing directory). The previous filename-only match, and the blind
 * "first .rs model" fallback in the caller, applied a diagnostic for one
 * crate's `lib.rs` to another crate's `lib.rs`. A URI that cannot be
 * attributed now returns null so the caller drops the markers.
 */
export function findMatchingModel(
  models: MonacoModel[],
  uri: string
): MonacoModel | null {
  const diagnosticSegments = uriPathSegments(uri);
  const diagnosticPath = diagnosticSegments.join('/');
  const diagnosticFilename = diagnosticSegments[diagnosticSegments.length - 1] || '';

  // Strategy 1: Exact match (checked across every model first, so two files
  // that share a filename can never resolve to each other's model).
  for (const model of models) {
    const modelUri = model.uri?.toString() || '';
    if (modelUri === uri) {
      console.log('[LSP Diagnostics] ✓ Exact URI match');
      return model;
    }
  }

    const modelSegments = uriPathSegments(modelUri);
    const modelPath = modelSegments.join('/');

    // Strategy 2: Same normalised path (differing only by `file://` prefix)
    if (modelPath && modelPath === diagnosticPath) {
      console.log('[LSP Diagnostics] ✓ Normalised path match');
  // Strategy 2: Both URIs contain same filename
  for (const model of models) {
    const modelUri = model.uri?.toString() || '';
    const modelFilename = modelUri.split('/').pop() || '';
    if (modelFilename === diagnosticFilename && diagnosticFilename.endsWith('.rs')) {
      console.log('[LSP Diagnostics] ✓ Filename match:', diagnosticFilename);
      return model;
    }
  }

    // Strategy 3: A full path (directory + filename) is a suffix/prefix of the
    // other, so two different crates' `lib.rs` files never match on filename
    // alone.
    if (
      diagnosticFilename.endsWith('.rs') &&
      (modelPath.endsWith('/' + diagnosticPath) ||
        diagnosticPath.endsWith('/' + modelPath))
    ) {
      console.log('[LSP Diagnostics] ✓ Path-segment match:', diagnosticPath);
  // Strategy 3: Path contains the other
  const uriPath = uri.replace('file://', '');
  for (const model of models) {
    const modelUri = model.uri?.toString() || '';
    if (modelUri.includes(uriPath) || uriPath.includes(modelUri.replace('file://', ''))) {
      console.log('[LSP Diagnostics] ✓ Path contains match');
      return model;
    }
  }

  return null;
}

/**
 * Apply markers to Monaco editor
 * Includes retry logic if Monaco isn't ready yet
 */
export function applyMarkersToEditor(
  uri: string,
  markers: MonacoMarker[],
  maxRetries = 3
): void {
  const applyWithRetry = (attempt: number) => {
    if (isUriClosed(uri)) {
      console.log(`[LSP Diagnostics] Dropping ${markers.length} markers for closed document: ${uri}`);
      return;
    }

    const windowWithMonaco = window as WindowWithMonaco;

    if (!windowWithMonaco.monacoInstance) {
      if (attempt < maxRetries) {
        console.warn(`[LSP Diagnostics] Monaco not available, retrying in 1s (attempt ${attempt + 1})`);
        setTimeout(() => applyWithRetry(attempt + 1), 1000);
      } else {
        console.error('[LSP Diagnostics] Monaco not available after retries');
      }
      return;
    }

    if (!windowWithMonaco.monacoInstance.editor) {
      console.error('[LSP Diagnostics] Monaco editor not available!');
      return;
    }

    const editor = windowWithMonaco.monacoInstance.editor;
    const models = editor.getModels() || [];
    
    console.log('[LSP Diagnostics] Available models:', models.map(m => m.uri?.toString()));
    console.log('[LSP Diagnostics] Diagnostic URI:', uri);

    // Find matching model. If none matches we must NOT guess: applying markers
    // to an arbitrary .rs model paints diagnostics onto a file with no error.
    const model = findMatchingModel(models, uri);

    if (!model) {
      console.warn(
        `[LSP Diagnostics] No matching model for URI: ${uri}; dropping ${markers.length} marker(s)`
      );
      return;
    }

    // Clear existing markers first, then set new ones
    editor.setModelMarkers(model, 'rust-analyzer', []);
    editor.setModelMarkers(model, 'rust-analyzer', markers);
    console.log(`[LSP Diagnostics] ✓ Set ${markers.length} markers on model`);
  };

  applyWithRetry(0);
}

/**
 * Handle incoming diagnostics from LSP
 */
export function handleDiagnostics(
  uri: string,
  diagnostics: Diagnostic[],
  onDiagnosticsCount?: (count: number) => void,
  onDiagnosticsUpdate?: (uri: string, diagnostics: Diagnostic[]) => void
): void {
  console.log(`[LSP Diagnostics]  Received ${diagnostics.length} diagnostics for ${uri}`);
  
  // Update count if callback provided
  if (onDiagnosticsCount) {
    onDiagnosticsCount(diagnostics.length);
  }

  // Store all diagnostics if callback provided
  if (onDiagnosticsUpdate) {
    onDiagnosticsUpdate(uri, diagnostics);
  }

  if (diagnostics.length === 0) {
    console.log('[LSP Diagnostics] No diagnostics to display');
  }

  const markers = convertToMonacoMarkers(diagnostics);
  console.log('[LSP Diagnostics] Converted markers:', markers);
  
  applyMarkersToEditor(uri, markers);
}
