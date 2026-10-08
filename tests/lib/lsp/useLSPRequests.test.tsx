import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import {
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
} from "@/lib/lsp/requests";
import { useLSPRequests } from "@/lib/lsp/hooks/useLSPRequests";

vi.mock("@/lib/lsp/requests", () => ({
  requestInlayHints: vi.fn(),
  requestHover: vi.fn(),
  requestCompletion: vi.fn(),
  requestDefinition: vi.fn(),
  requestReferences: vi.fn(),
  requestPrepareRename: vi.fn(),
  requestRename: vi.fn(),
  requestSignatureHelp: vi.fn(),
  requestFormatting: vi.fn(),
  requestCodeAction: vi.fn(),
  requestDocumentSymbols: vi.fn(),
  requestDocumentHighlight: vi.fn(),
}));

// React 19 requires this flag so `act(...)` does not warn about the test env.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

const URI = "file:///src/main.rs";
const POSITION = { line: 1, character: 2 };
const RANGE = { start: POSITION, end: { line: 1, character: 5 } };

// The runtime keys of `LSPFunctionsRef` in components/Editor/types.ts.
// (requestSignatureHelp is returned by the hook in addition to the type.)
const LSP_FUNCTION_KEYS = [
  "requestInlayHints",
  "requestCompletion",
  "requestHover",
  "requestDefinition",
  "requestReferences",
  "requestPrepareRename",
  "requestRename",
  "requestFormatting",
  "requestCodeAction",
  "requestDocumentSymbols",
  "requestDocumentHighlight",
];

function renderRequests(
  wsRef: { current: WebSocket | null },
  isInitialized: boolean,
) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  const result: { current: ReturnType<typeof useLSPRequests> } = {
    current: undefined as unknown as ReturnType<typeof useLSPRequests>,
  };

  function Probe() {
    result.current = useLSPRequests({ wsRef, isInitialized });
    return null;
  }

  act(() => {
    root.render(createElement(Probe));
  });

  return {
    result,
    unmount: () => {
      act(() => root.unmount());
      container.remove();
    },
  };
}

function fakeSocket(): WebSocket {
  return { readyState: 1, send: vi.fn() } as unknown as WebSocket;
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("useLSPRequests", () => {
  it("exposes every function declared by LSPFunctionsRef", () => {
    const wsRef = { current: fakeSocket() };
    const { result } = renderRequests(wsRef, true);

    for (const key of LSP_FUNCTION_KEYS) {
      expect(typeof (result.current as Record<string, unknown>)[key]).toBe(
        "function",
      );
    }

    // The hook additionally surfaces requestSignatureHelp.
    const actualKeys = Object.keys(result.current).sort();
    expect(actualKeys).toEqual(
      [...LSP_FUNCTION_KEYS, "requestSignatureHelp"].sort(),
    );
  });

  it("forwards the socket, uri and position unchanged to each request builder", () => {
    const ws = fakeSocket();
    const wsRef = { current: ws };
    (requestHover as unknown as Mock).mockResolvedValue({ contents: "x" });
    (requestDefinition as unknown as Mock).mockResolvedValue([]);
    (requestReferences as unknown as Mock).mockResolvedValue([]);
    (requestDocumentHighlight as unknown as Mock).mockResolvedValue([]);
    (requestDocumentSymbols as unknown as Mock).mockResolvedValue([]);
    (requestInlayHints as unknown as Mock).mockResolvedValue([]);
    (requestCompletion as unknown as Mock).mockResolvedValue([]);
    (requestPrepareRename as unknown as Mock).mockResolvedValue(null);
    (requestRename as unknown as Mock).mockResolvedValue(null);
    (requestSignatureHelp as unknown as Mock).mockResolvedValue(null);
    (requestFormatting as unknown as Mock).mockResolvedValue([]);
    (requestCodeAction as unknown as Mock).mockResolvedValue([]);

    const { result } = renderRequests(wsRef, true);

    result.current.requestHover(URI, POSITION);
    result.current.requestDefinition(URI, POSITION);
    result.current.requestReferences(URI, POSITION, { includeDeclaration: false });
    result.current.requestDocumentHighlight(URI, POSITION);
    result.current.requestDocumentSymbols(URI);
    result.current.requestInlayHints(URI, { startLine: 0, endLine: 3 });
    result.current.requestCompletion(URI, POSITION);
    result.current.requestPrepareRename(URI, POSITION);
    result.current.requestRename(URI, POSITION, "renamed");
    result.current.requestSignatureHelp(URI, POSITION);
    result.current.requestFormatting(URI);
    result.current.requestCodeAction(URI, RANGE, { diagnostics: [] });

    expect(requestHover).toHaveBeenCalledWith(ws, URI, POSITION);
    expect(requestDefinition).toHaveBeenCalledWith(ws, URI, POSITION);
    expect(requestReferences).toHaveBeenCalledWith(ws, URI, POSITION, {
      includeDeclaration: false,
    });
    expect(requestDocumentHighlight).toHaveBeenCalledWith(ws, URI, POSITION);
    expect(requestDocumentSymbols).toHaveBeenCalledWith(ws, URI);
    expect(requestInlayHints).toHaveBeenCalledWith(ws, URI, {
      startLine: 0,
      endLine: 3,
    });
    expect(requestCompletion).toHaveBeenCalledWith(ws, URI, POSITION);
    expect(requestPrepareRename).toHaveBeenCalledWith(ws, URI, POSITION);
    expect(requestRename).toHaveBeenCalledWith(ws, URI, POSITION, "renamed");
    expect(requestSignatureHelp).toHaveBeenCalledWith(ws, URI, POSITION);
    expect(requestFormatting).toHaveBeenCalledWith(ws, URI);
    expect(requestCodeAction).toHaveBeenCalledWith(ws, URI, RANGE, {
      diagnostics: [],
    });
  });

  it("degrades gracefully with an absent socket or before initialization", async () => {
    const absent = renderRequests({ current: null }, true);
    await expect(absent.result.current.requestHover(URI, POSITION)).resolves.toBeNull();
    await expect(
      absent.result.current.requestDefinition(URI, POSITION),
    ).resolves.toEqual([]);
    await expect(
      absent.result.current.requestDocumentSymbols(URI),
    ).resolves.toEqual([]);
    await expect(
      absent.result.current.requestFormatting(URI),
    ).resolves.toEqual([]);

    const notReady = renderRequests({ current: fakeSocket() }, false);
    await expect(
      notReady.result.current.requestReferences(URI, POSITION),
    ).resolves.toEqual([]);
    await expect(
      notReady.result.current.requestInlayHints(URI, { startLine: 0, endLine: 1 }),
    ).resolves.toEqual([]);

    expect(requestHover).not.toHaveBeenCalled();
    expect(requestDefinition).not.toHaveBeenCalled();
    expect(requestReferences).not.toHaveBeenCalled();
  });
});
