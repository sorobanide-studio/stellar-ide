/**
 * LSP Module Exports
 */

// Main hook
export { useLSPClient, type OnDiagnosticsUpdate } from './useLSPClient';

// Types
export type {
  Diagnostic,
  MonacoModel,
  MonacoEditor,
  MonacoMarker,
  MonacoInstance,
  WindowWithMonaco,
  InlayHint,
  LSPCapabilities,
  LSPInitializeParams,
  LSPMessage,
} from './types';

// Capabilities
export { LSP_CAPABILITIES, createInitializeRequest } from './capabilities';

// Diagnostics
export {
  convertToMonacoMarkers,
  findMatchingModel,
  applyMarkersToEditor,
  handleDiagnostics,
} from './diagnostics';

// Requests
export {
  createRequestId,
  sendDidOpen,
  sendDidChange,
  sendDidClose,
  sendInitialized,
  requestInlayHints,
  requestHover,
  requestCompletion,
  requestDefinition,
  requestReferences,
  requestPrepareRename,
  requestRename,
  requestSignatureHelp,
  requestFormatting,
  requestCodeAction,
  requestDocumentSymbols,
  requestDocumentHighlight,
  type CodeAction,
  type DocumentSymbol,
  type DocumentHighlight,
} from './requests';
