import { PassThrough } from "node:stream";
import { describe, expect, it } from "vitest";
import { StreamMessageReader } from "vscode-languageserver/node";

/**
 * `stellar-lsp-server/src/lsp-connection.ts` does not hand-roll the
 * `Content-Length` framing — it delegates it to `StreamMessageReader` from
 * `vscode-languageserver/node` (see `createLSPConnection`). These tests pin the
 * framing contract that the connection relies on: byte-accurate
 * `Content-Length`, frames split across TCP chunks, several frames per chunk,
 * and malformed headers that must not throw out of the parser.
 */
function frame(payload: unknown): Buffer {
  const body = Buffer.from(JSON.stringify(payload), "utf8");
  const header = Buffer.from(`Content-Length: ${body.length}\r\n\r\n`, "ascii");
  return Buffer.concat([header, body]);
}

function createReader() {
  const stream = new PassThrough();
  const reader = new StreamMessageReader(stream);
  // Disable the partial-message timer so no timers leak between tests.
  reader.partialMessageTimeout = 0;
  const messages: unknown[] = [];
  const errors: Error[] = [];

  reader.onError((error: Error) => errors.push(error));
  reader.listen((message: unknown) => messages.push(message));

  return { stream, reader, messages, errors };
}

async function settle(): Promise<void> {
  for (let i = 0; i < 5; i++) {
    await new Promise((resolve) => setImmediate(resolve));
  }
}

describe("lsp-connection message framing", () => {
  it("parses a complete frame", async () => {
    const { stream, messages, errors } = createReader();
    const payload = { jsonrpc: "2.0", id: 1, method: "initialize", params: {} };

    stream.write(frame(payload));
    await settle();

    expect(errors).toEqual([]);
    expect(messages).toEqual([payload]);

    stream.destroy();
  });

  it("parses a frame split across three chunks", async () => {
    const { stream, messages } = createReader();
    const payload = {
      jsonrpc: "2.0",
      id: 2,
      result: { ok: true, items: [1, 2, 3] },
    };
    const buffer = frame(payload);
    const first = Math.floor(buffer.length / 3);
    const second = Math.floor((buffer.length * 2) / 3);

    stream.write(buffer.subarray(0, first));
    await settle();
    expect(messages).toEqual([]);

    stream.write(buffer.subarray(first, second));
    await settle();
    expect(messages).toEqual([]);

    stream.write(buffer.subarray(second));
    await settle();
    expect(messages).toEqual([payload]);

    stream.destroy();
  });

  it("parses two frames delivered in a single chunk", async () => {
    const { stream, messages } = createReader();
    const first = { jsonrpc: "2.0", id: 3, result: "one" };
    const second = { jsonrpc: "2.0", method: "textDocument/didOpen", params: {} };

    stream.write(Buffer.concat([frame(first), frame(second)]));
    await settle();

    expect(messages).toEqual([first, second]);

    stream.destroy();
  });

  it("counts Content-Length in bytes, not characters, for multi-byte UTF-8", async () => {
    const { stream, messages } = createReader();
    const payload = {
      jsonrpc: "2.0",
      id: 4,
      result: { text: "héllo — 世界 🚀" },
    };
    const body = JSON.stringify(payload);

    // Sanity check: the body really does contain multi-byte characters.
    expect(Buffer.byteLength(body, "utf8")).toBeGreaterThan(body.length);

    stream.write(frame(payload));
    await settle();

    expect(messages).toEqual([payload]);

    stream.destroy();
  });

  it("rejects a malformed Content-Length without throwing out of the parser", async () => {
    const { stream, messages, errors } = createReader();

    expect(() =>
      stream.write(Buffer.from("Content-Length: not-a-number\r\n\r\n{}", "ascii")),
    ).not.toThrow();

    await settle();

    expect(messages).toEqual([]);
    expect(errors.length).toBeGreaterThan(0);

    stream.destroy();
  });

  it("does not throw on a garbage header it cannot parse", async () => {
    const { stream, messages } = createReader();

    expect(() =>
      stream.write(Buffer.from("this is not a header at all\r\n\r\n", "ascii")),
    ).not.toThrow();

    await settle();

    expect(messages).toEqual([]);

    stream.destroy();
  });
});
