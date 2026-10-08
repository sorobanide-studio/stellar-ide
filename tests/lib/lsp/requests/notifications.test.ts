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
