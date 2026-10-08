/**
 * LSP Requests Module
 * Centralized exports for all LSP request functions
 */

// Utilities
export { createRequestId } from './utils';
export type { TextEdit } from './utils';

// Notifications
export {
  sendDidOpen,
  sendDidChange,
  sendDidClose,
  sendInitialized,
} from './notifications';

// Navigation
export {
  requestDefinition,
  requestReferences,
  requestHover,
  requestDocumentSymbols,
  requestDocumentHighlight,
} from './navigation';
export type { DocumentSymbol, DocumentHighlight } from './navigation';

// Editing
export {
  requestCompletion,
  requestSignatureHelp,
  requestFormatting,
} from './editing';

// Refactoring
export {
  requestPrepareRename,
  requestRename,
  requestCodeAction,
} from './refactoring';
export type { CodeAction } from './refactoring';

// Inlay Hints
export { requestInlayHints } from './inlayHints';
