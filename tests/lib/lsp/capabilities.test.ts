import { describe, expect, it } from "vitest";
import {
  createInitializeRequest,
  LSP_CAPABILITIES,
} from "../../../lib/lsp/capabilities";
import { registerCompletionProvider } from "../../../components/Editor/completionProvider";
import { registerHoverProvider } from "../../../components/Editor/hoverProvider";
import { registerDefinitionProvider } from "../../../components/Editor/definitionProvider";
import { registerReferenceProvider } from "../../../components/Editor/referenceProvider";
import { registerDocumentSymbolProvider } from "../../../components/Editor/documentSymbolProvider";
import { registerCodeActionProvider } from "../../../components/Editor/codeActionProvider";
import { registerFormatProvider } from "../../../components/Editor/formatProvider";
import { registerRenameProvider } from "../../../components/Editor/renameProvider";
import { registerDocumentHighlightProvider } from "../../../components/Editor/documentHighlightProvider";
import { registerInlayHintsProvider } from "../../../components/Editor/inlayHints";

/**
 * The editor registers one Monaco provider per feature; each one needs the
 * matching server capability advertised or the request is never sent.
 */
const PROVIDER_CAPABILITIES: Array<{
  capability: string;
  register: unknown;
}> = [
  { capability: "completion", register: registerCompletionProvider },
  { capability: "hover", register: registerHoverProvider },
  { capability: "definition", register: registerDefinitionProvider },
  { capability: "references", register: registerReferenceProvider },
  { capability: "documentSymbol", register: registerDocumentSymbolProvider },
  { capability: "codeAction", register: registerCodeActionProvider },
  { capability: "formatting", register: registerFormatProvider },
  { capability: "rename", register: registerRenameProvider },
  {
    capability: "documentHighlight",
    register: registerDocumentHighlightProvider,
  },
  { capability: "inlayHint", register: registerInlayHintsProvider },
];

describe("LSP_CAPABILITIES", () => {
  it("advertises a capability for every provider registered in components/Editor", () => {
    const textDocument = LSP_CAPABILITIES.textDocument as Record<
      string,
      unknown
    >;

    for (const { capability, register } of PROVIDER_CAPABILITIES) {
      expect(typeof register).toBe("function");
      expect(textDocument[capability]).toBeDefined();
    }
    expect(PROVIDER_CAPABILITIES).toHaveLength(10);
  });

  it("advertises the specific keys the providers depend on", () => {
    const td = LSP_CAPABILITIES.textDocument;
    expect(td.completion.completionItem.snippetSupport).toBe(true);
    expect(td.hover.contentFormat).toEqual(["markdown", "plaintext"]);
    expect(td.definition.linkSupport).toBe(true);
    expect(td.references).toBeDefined();
    expect(td.documentSymbol.hierarchicalDocumentSymbolSupport).toBe(true);
    expect(
      td.codeAction.codeActionLiteralSupport.codeActionKind.valueSet,
    ).toContain("quickfix");
    expect(td.formatting).toBeDefined();
    expect(td.rename.prepareSupport).toBe(true);
    expect(td.inlayHint).toBeDefined();
  });

  it("advertises didClose so the server can release documents", () => {
    expect(LSP_CAPABILITIES.textDocument.synchronization.didClose).toBe(true);
  });
});

describe("createInitializeRequest", () => {
  it("returns a JSON-RPC initialize request with the given id", () => {
    const request = createInitializeRequest(7);

    expect(request.jsonrpc).toBe("2.0");
    expect(request.method).toBe("initialize");
    expect(request.id).toBe(7);
  });

  it("hardcodes the workspace root and a single workspace folder", () => {
    const { params } = createInitializeRequest(1);

    expect(params.processId).toBeNull();
    expect(params.rootUri).toBe("file:///home/developer/workspace");
    expect(params.workspaceFolders).toEqual([
      { uri: "file:///home/developer/workspace", name: "workspace" },
    ]);
    expect(params.capabilities).toBe(LSP_CAPABILITIES);
  });

  it("is JSON-serialisable into the exact wire payload", () => {
    const request = createInitializeRequest(42);
    const wire = JSON.parse(JSON.stringify(request));

    expect(wire).toEqual({
      jsonrpc: "2.0",
      method: "initialize",
      params: {
        processId: null,
        rootUri: "file:///home/developer/workspace",
        capabilities: LSP_CAPABILITIES,
        workspaceFolders: [
          { uri: "file:///home/developer/workspace", name: "workspace" },
        ],
      },
      id: 42,
    });
  });
});
