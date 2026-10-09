/**
 * Provider Capability Registry
 *
 * Single source of truth linking each Monaco language provider to the LSP
 * `textDocument` capability it depends on. `MonacoEditor` registers providers
 * by iterating this list and the capability-parity test reads the same list, so
 * a newly registered provider cannot silently drift from `LSP_CAPABILITIES`.
 */

import type { MonacoType } from "./types";
import { registerInlayHintsProvider } from "./inlayHints";
import { registerCompletionProvider } from "./completionProvider";
import { registerHoverProvider } from "./hoverProvider";
import { registerDefinitionProvider } from "./definitionProvider";
import { registerReferenceProvider } from "./referenceProvider";
import { registerRenameProvider } from "./renameProvider";
import { registerFormatProvider } from "./formatProvider";
import { registerCodeActionProvider } from "./codeActionProvider";
import { registerDocumentSymbolProvider } from "./documentSymbolProvider";
import { registerDocumentHighlightProvider } from "./documentHighlightProvider";

/** Keys of `LSP_CAPABILITIES.textDocument` that a provider or request relies on. */
export type ProviderCapability =
  | "completion"
  | "hover"
  | "signatureHelp"
  | "definition"
  | "references"
  | "documentHighlight"
  | "documentSymbol"
  | "codeAction"
  | "formatting"
  | "rename"
  | "inlayHint";

export interface ProviderRegistration {
  /** Capability the provider consumes. */
  capability: ProviderCapability;
  /** Registers the Monaco provider for the `rust` language. */
  register: (monaco: MonacoType) => unknown;
}

/**
 * Every Monaco provider registered by the editor, in registration order,
 * paired with the capability it depends on.
 */
export const PROVIDER_REGISTRATIONS: readonly ProviderRegistration[] = [
  { capability: "inlayHint", register: registerInlayHintsProvider },
  { capability: "completion", register: registerCompletionProvider },
  { capability: "hover", register: registerHoverProvider },
  { capability: "definition", register: registerDefinitionProvider },
  { capability: "references", register: registerReferenceProvider },
  { capability: "rename", register: registerRenameProvider },
  { capability: "formatting", register: registerFormatProvider },
  { capability: "codeAction", register: registerCodeActionProvider },
  { capability: "documentSymbol", register: registerDocumentSymbolProvider },
  { capability: "documentHighlight", register: registerDocumentHighlightProvider },
];

/**
 * LSP request functions exposed on `window.lspFunctions`, paired with the
 * capability each request needs. `requestSignatureHelp` is advertised here even
 * though no Monaco provider consumes `signatureHelp` yet.
 */
export const LSP_REQUEST_CAPABILITIES = {
  requestInlayHints: "inlayHint",
  requestCompletion: "completion",
  requestHover: "hover",
  requestDefinition: "definition",
  requestReferences: "references",
  requestPrepareRename: "rename",
  requestRename: "rename",
  requestFormatting: "formatting",
  requestCodeAction: "codeAction",
  requestDocumentSymbols: "documentSymbol",
  requestDocumentHighlight: "documentHighlight",
  requestSignatureHelp: "signatureHelp",
} as const satisfies Record<string, ProviderCapability>;
