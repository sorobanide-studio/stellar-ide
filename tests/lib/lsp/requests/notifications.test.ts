import { describe, expect, it } from "vitest";
import * as notifications from "../../../../lib/lsp/requests/notifications";

const URI = "file:///src/main.rs";

interface RecordingSocket {
  sent: Array<Record<string, unknown>>;
  send(data: string): void;
}

function createSocket(): RecordingSocket {
  const sent: Array<Record<string, unknown>> = [];
  return {
    sent,
    send(data: string) {
      sent.push(JSON.parse(data) as Record<string, unknown>);
    },
  };
}

function asWebSocket(socket: RecordingSocket): WebSocket {
  return socket as unknown as WebSocket;
}

describe("document-sync notifications", () => {
  it("sendDidOpen writes a didOpen envelope with languageId 'rust'", () => {
    const socket = createSocket();

    notifications.sendDidOpen(
      asWebSocket(socket),
      URI,
      "fn main() {}",
      3,
    );

    expect(socket.sent).toEqual([
      {
        jsonrpc: "2.0",
        method: "textDocument/didOpen",
        params: {
          textDocument: {
            uri: URI,
            languageId: "rust",
            version: 3,
            text: "fn main() {}",
          },
        },
      },
    ]);
  });

  it("sendDidChange writes a didChange envelope and forwards the version", () => {
    const socket = createSocket();

    notifications.sendDidChange(
      asWebSocket(socket),
      URI,
      "fn main() { let x = 1; }",
      4,
    );

    expect(socket.sent).toEqual([
      {
        jsonrpc: "2.0",
        method: "textDocument/didChange",
        params: {
          textDocument: { uri: URI, version: 4 },
          contentChanges: [{ text: "fn main() { let x = 1; }" }],
        },
      },
    ]);
  });

  it("sendInitialized writes an initialized envelope with empty params", () => {
    const socket = createSocket();

    notifications.sendInitialized(asWebSocket(socket));

    expect(socket.sent).toEqual([
      { jsonrpc: "2.0", method: "initialized", params: {} },
    ]);
  });

  it("exports exactly the three implemented document-sync notifications", () => {
    expect(Object.keys(notifications).sort()).toEqual([
      "sendDidChange",
      "sendDidOpen",
      "sendInitialized",
    ]);
  });

  // The capabilities advertise didClose/didSave, but the module does not
  // implement them. Recording the gap as an explicit (expected) failure means
  // the suite turns red the moment one of them is added, forcing the test to
  // be updated alongside the implementation.
  it.fails(
    "does not yet implement sendDidClose (documented gap)",
    () => {
      expect(
        typeof (notifications as Record<string, unknown>).sendDidClose,
      ).toBe("function");
    },
  );

  it.fails(
    "does not yet implement sendDidSave (documented gap)",
    () => {
      expect(
        typeof (notifications as Record<string, unknown>).sendDidSave,
      ).toBe("function");
    },
  );
});
import { describe, expect, it, vi } from "vitest";
import {
  sendDidClose,
  sendDidOpen,
} from "@/lib/lsp/requests/notifications";

function fakeSocket() {
  const send = vi.fn();
  return { send, socket: { send } as unknown as WebSocket };
}

describe("sendDidClose", () => {
  it("sends a textDocument/didClose envelope for the given uri", () => {
    const { send, socket } = fakeSocket();
    const uri = "file:///home/developer/workspace/my-contract/src/lib.rs";

    sendDidClose(socket, uri);

    expect(send).toHaveBeenCalledTimes(1);
    expect(JSON.parse(send.mock.calls[0][0])).toEqual({
      jsonrpc: "2.0",
      method: "textDocument/didClose",
      params: {
        textDocument: { uri },
      },
    });
  });

  it("does not include the document version or text (spec: close carries only the uri)", () => {
    const { send, socket } = fakeSocket();
    sendDidClose(socket, "file:///a/b.rs");
    const envelope = JSON.parse(send.mock.calls[0][0]);
    expect(envelope.params.textDocument).not.toHaveProperty("version");
    expect(envelope.params.textDocument).not.toHaveProperty("text");
  });

  it("is exported alongside the other document-sync notifications", () => {
    const { send, socket } = fakeSocket();
    sendDidOpen(socket, "file:///a/b.rs", "fn main() {}", 1);
    expect(JSON.parse(send.mock.calls[0][0]).method).toBe("textDocument/didOpen");
  });
});
