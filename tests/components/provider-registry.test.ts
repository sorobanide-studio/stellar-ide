import { describe, expect, it, vi } from "vitest";
import {
  registerLanguageProviders,
  disposeLanguageProviders,
} from "../../components/Editor/providerRegistry";

type Disposable = { dispose: () => void };

function createFakeMonaco() {
  const created: Disposable[] = [];
  const makeDisposable = (): Disposable => {
    const disposable: Disposable = { dispose: vi.fn() };
    created.push(disposable);
    return disposable;
  };

  const languages = {
    registerInlayHintsProvider: vi.fn(makeDisposable),
    registerCompletionItemProvider: vi.fn(makeDisposable),
    registerHoverProvider: vi.fn(makeDisposable),
    registerDefinitionProvider: vi.fn(makeDisposable),
    registerReferenceProvider: vi.fn(makeDisposable),
    registerRenameProvider: vi.fn(makeDisposable),
    registerDocumentFormattingEditProvider: vi.fn(makeDisposable),
    registerCodeActionProvider: vi.fn(makeDisposable),
    registerDocumentSymbolProvider: vi.fn(makeDisposable),
    registerDocumentHighlightProvider: vi.fn(makeDisposable),
  };

  return { monaco: { languages } as never, languages, created };
}

describe("Monaco language provider registry", () => {
  it("registers each provider exactly once across two mount cycles", () => {
    const { monaco, languages } = createFakeMonaco();

    registerLanguageProviders(monaco); // first mount
    registerLanguageProviders(monaco); // second mount / re-render

    for (const register of Object.values(languages)) {
      expect(register).toHaveBeenCalledTimes(1);
    }
  });

  it("disposes the retained disposables on unmount and can register again", () => {
    const { monaco, languages, created } = createFakeMonaco();

    registerLanguageProviders(monaco);
    expect(created.length).toBe(Object.keys(languages).length);

    disposeLanguageProviders(monaco);
    for (const disposable of created) {
      expect(disposable.dispose).toHaveBeenCalledTimes(1);
    }

    registerLanguageProviders(monaco); // remount
    for (const register of Object.values(languages)) {
      expect(register).toHaveBeenCalledTimes(2);
    }
  });
});
