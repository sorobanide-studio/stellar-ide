/**
 * Monaco language provider registry.
 *
 * Registers every LSP-backed language provider for a Monaco instance exactly
 * once and retains the returned disposables so they can be released when the
 * editor unmounts. Providers read window.lspFunctions lazily at request time,
 * so registration is independent of the request callbacks.
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

export interface ProviderDisposable {
  dispose: () => void;
}

type ProviderRegistrar = (monaco: MonacoType) => ProviderDisposable | null;

const providerRegistrars: ProviderRegistrar[] = [
  registerInlayHintsProvider,
  registerCompletionProvider,
  registerHoverProvider,
  registerDefinitionProvider,
  registerReferenceProvider,
  registerRenameProvider,
  registerFormatProvider,
  registerCodeActionProvider,
  registerDocumentSymbolProvider,
  registerDocumentHighlightProvider,
];

/**
 * Disposables for every provider registered against a given Monaco instance.
 * Keyed by instance so a second editor or a remount never double-registers.
 */
const registeredProviders = new WeakMap<MonacoType, ProviderDisposable[]>();

/**
 * Register all language providers for `monaco` exactly once. Repeated calls
 * with the same Monaco instance return the original disposables.
 */
export function registerLanguageProviders(
  monaco: MonacoType
): ProviderDisposable[] {
  const existing = registeredProviders.get(monaco);
  if (existing) {
    return existing;
  }

  const disposables: ProviderDisposable[] = [];
  for (const register of providerRegistrars) {
    const disposable = register(monaco);
    if (disposable) {
      disposables.push(disposable);
    }
  }

  registeredProviders.set(monaco, disposables);
  return disposables;
}

/**
 * Dispose every provider registered for `monaco` and forget the instance so a
 * later mount can register again.
 */
export function disposeLanguageProviders(monaco: MonacoType): void {
  const disposables = registeredProviders.get(monaco);
  if (!disposables) {
    return;
  }

  for (const disposable of disposables) {
    disposable.dispose();
  }
  registeredProviders.delete(monaco);
}
