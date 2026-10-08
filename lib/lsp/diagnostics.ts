/**
 * LSP Diagnostics Handler
 * Handles converting and applying diagnostics to Monaco editor
 */

import { Diagnostic, MonacoMarker, WindowWithMonaco, MonacoModel } from './types';

/**
 * Convert LSP diagnostics to Monaco markers
 * LSP severity: 1=Error, 2=Warning, 3=Info, 4=Hint
 * Monaco severity: 8=Error, 4=Warning, 2=Info, 1=Hint
 */
export function convertToMonacoMarkers(diagnostics: Diagnostic[]): MonacoMarker[] {
  return diagnostics.map((diag) => ({
    startLineNumber: diag.range.start.line + 1,
    startColumn: diag.range.start.character + 1,
    endLineNumber: diag.range.end.line + 1,
    endColumn: diag.range.end.character + 1,
    message: diag.message,
    severity: diag.severity === 1 ? 8 : diag.severity === 2 ? 4 : 2,
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

  for (const model of models) {
    const modelUri = model.uri?.toString() || '';

    // Strategy 1: Exact match
    if (modelUri === uri) {
      console.log('[LSP Diagnostics] ✓ Exact URI match');
      return model;
    }

    const modelSegments = uriPathSegments(modelUri);
    const modelPath = modelSegments.join('/');

    // Strategy 2: Same normalised path (differing only by `file://` prefix)
    if (modelPath && modelPath === diagnosticPath) {
      console.log('[LSP Diagnostics] ✓ Normalised path match');
      return model;
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
