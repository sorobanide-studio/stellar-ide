import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import {
  requestDefinition,
  requestReferences,
  requestHover,
  requestDocumentSymbols,
  requestDocumentHighlight,
} from "../../../../lib/lsp/requests/navigation";
import { requestPrepareRename } from "../../../../lib/lsp/requests/refactoring";

const URI = "file:///src/main.rs";
const POSITION = { line: 4, character: 2 };

type MessageListener = (event: { data: string }) => void;

interface FakeSocket {
  readyState: number;
  sent: Array<Record<string, unknown>>;
  send(data: string): void;
  addEventListener(type: string, listener: MessageListener): void;
  removeEventListener(type: string, listener: MessageListener): void;
  emit(message: unknown): void;
}

function createSocket(open = true): FakeSocket {
  const listeners = new Set<MessageListener>();
  const sent: Array<Record<string, unknown>> = [];

  return {
    readyState: open ? 1 : 3,
    sent,
    send(data: string) {
      sent.push(JSON.parse(data) as Record<string, unknown>);
    },
    addEventListener(type: string, listener: MessageListener) {
      if (type === "message") listeners.add(listener);
    },
    removeEventListener(type: string, listener: MessageListener) {
      if (type === "message") listeners.delete(listener);
    },
    emit(message: unknown) {
      for (const listener of [...listeners]) {
        listener({ data: JSON.stringify(message) });
      }
    },
  };
}

function start(fn: (ws: WebSocket) => Promise<unknown>) {
  const socket = createSocket();
  const promise = fn(socket as unknown as WebSocket);
  const request = socket.sent[0] as { id: number; method: string };
  return { socket, promise, request };
}

beforeEach(() => {
  vi.stubGlobal("WebSocket", {
    CONNECTING: 0,
    OPEN: 1,
    CLOSING: 2,
    CLOSED: 3,
  });
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("navigation request builders", () => {
  it("uses the exact LSP method strings and forwards uri/position", () => {
    const definition = start((ws) => requestDefinition(ws, URI, POSITION));
    expect(definition.request.method).toBe("textDocument/definition");
    expect(definition.request.params).toEqual({
      textDocument: { uri: URI },
      position: POSITION,
    });

    const references = start((ws) => requestReferences(ws, URI, POSITION));
    expect(references.request.method).toBe("textDocument/references");
    expect(references.request.params).toEqual({
      textDocument: { uri: URI },
      position: POSITION,
      context: { includeDeclaration: true },
    });

    const hover = start((ws) => requestHover(ws, URI, POSITION));
    expect(hover.request.method).toBe("textDocument/hover");
    expect(hover.request.params).toEqual({
      textDocument: { uri: URI },
      position: POSITION,
    });

    const symbols = start((ws) => requestDocumentSymbols(ws, URI));
    expect(symbols.request.method).toBe("textDocument/documentSymbol");
    expect(symbols.request.params).toEqual({ textDocument: { uri: URI } });

    const highlight = start((ws) => requestDocumentHighlight(ws, URI, POSITION));
    expect(highlight.request.method).toBe("textDocument/documentHighlight");
    expect(highlight.request.params).toEqual({
      textDocument: { uri: URI },
      position: POSITION,
    });

    const prepareRename = start((ws) => requestPrepareRename(ws, URI, POSITION));
    expect(prepareRename.request.method).toBe("textDocument/prepareRename");
    expect(prepareRename.request.params).toEqual({
      textDocument: { uri: URI },
      position: POSITION,
    });
  });

  it("resolves hover with the matching response result", async () => {
    const { socket, promise, request } = start((ws) =>
      requestHover(ws, URI, POSITION),
    );

    socket.emit({ id: request.id, result: { contents: "fn main()" } });

    await expect(promise).resolves.toEqual({ contents: "fn main()" });
  });

  it("wraps a single definition result in an array", async () => {
    const { socket, promise, request } = start((ws) =>
      requestDefinition(ws, URI, POSITION),
    );
    const location = { uri: URI, range: { start: POSITION, end: POSITION } };

    socket.emit({ id: request.id, result: location });

    await expect(promise).resolves.toEqual([location]);
  });

  it("resolves references with the array result", async () => {
    const { socket, promise, request } = start((ws) =>
      requestReferences(ws, URI, POSITION),
    );
    const locations = [{ uri: URI }, { uri: "file:///src/lib.rs" }];

    socket.emit({ id: request.id, result: locations });

    await expect(promise).resolves.toEqual(locations);
  });

  it("ignores responses that do not match the request id", async () => {
    const { socket, promise } = start((ws) => requestHover(ws, URI, POSITION));

    socket.emit({ id: -1, result: { contents: "someone else" } });
    await vi.advanceTimersByTimeAsync(3000);

    await expect(promise).resolves.toBeNull();
  });

  it("does not resolve an errored hover as a success", async () => {
    const { socket, promise, request } = start((ws) =>
      requestHover(ws, URI, POSITION),
    );

    socket.emit({
      id: request.id,
      error: { code: -32601, message: "method not found" },
    });

    await expect(promise).resolves.toBeNull();
  });

  it("does not resolve an errored definition as a success", async () => {
    const { socket, promise, request } = start((ws) =>
      requestDefinition(ws, URI, POSITION),
    );

    socket.emit({
      id: request.id,
      error: { code: -32601, message: "method not found" },
    });

    await expect(promise).resolves.toEqual([]);
  });

  it("resolves empty when the response never arrives (timeout)", async () => {
    const { promise } = start((ws) => requestDocumentSymbols(ws, URI));

    await vi.advanceTimersByTimeAsync(5000);

    await expect(promise).resolves.toEqual([]);
  });

  it("resolves immediately when the socket is not open", async () => {
    const socket = createSocket(false);

    const promise = requestDefinition(socket as unknown as WebSocket, URI, POSITION);

    expect(socket.sent).toHaveLength(0);
    await expect(promise).resolves.toEqual([]);
  });
});
