/**
 * LSP Diagnostics Handler
 * Handles converting and applying diagnostics to Monaco editor
 */

import { Diagnostic, MonacoMarker, WindowWithMonaco, MonacoModel } from './types';

/**
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
    severity: MONACO_SEVERITY[diag.severity] ?? 2,
  }));
}

/**
 * Find matching Monaco model for a given URI
 * Uses multiple strategies to match URIs
 */
export function findMatchingModel(
  models: MonacoModel[],
  uri: string
): MonacoModel | null {
  const diagnosticFilename = uri.split('/').pop() || '';

  // Strategy 1: Exact match (checked across every model first, so two files
  // that share a filename can never resolve to each other's model).
  for (const model of models) {
    const modelUri = model.uri?.toString() || '';
    if (modelUri === uri) {
      console.log('[LSP Diagnostics] ✓ Exact URI match');
      return model;
    }
  }

  // Strategy 2: Both URIs contain same filename
  for (const model of models) {
    const modelUri = model.uri?.toString() || '';
    const modelFilename = modelUri.split('/').pop() || '';
    if (modelFilename === diagnosticFilename && diagnosticFilename.endsWith('.rs')) {
      console.log('[LSP Diagnostics] ✓ Filename match:', diagnosticFilename);
      return model;
    }
  }

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

    // Find matching model
    let model = findMatchingModel(models, uri);

    // Fallback: use first .rs model if no match found
    if (!model) {
      console.warn('[LSP Diagnostics] Model not found for URI:', uri);
      model = models.find(m => m.uri?.toString().endsWith('.rs')) || null;
      if (model) {
        console.log('[LSP Diagnostics]Using fallback .rs model');
      }
    }

    if (model) {
      // Clear existing markers first, then set new ones
      editor.setModelMarkers(model, 'rust-analyzer', []);
      editor.setModelMarkers(model, 'rust-analyzer', markers);
      console.log(`[LSP Diagnostics] ✓ Set ${markers.length} markers on model`);
    } else {
      console.error('[LSP Diagnostics] No suitable model found');
    }
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
