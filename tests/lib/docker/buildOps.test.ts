import { describe, expect, it, vi, beforeEach } from "vitest";
import { buildContract, decodeWasmSize } from "@/lib/docker/buildOps";

vi.mock("@/lib/docker/utils", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/docker/utils")>();
  return { ...actual, execAsync: vi.fn() };
});

import { execAsync } from "@/lib/docker/utils";

const mockedExec = vi.mocked(execAsync);

describe("decodeWasmSize", () => {
  it("reports the decoded byte length, not the base64 string length", () => {
    // A known fixture: 300 bytes of pseudo-random data.
    const bytes = Buffer.alloc(300);
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = (i * 37 + 11) % 256;
    }
    const base64 = bytes.toString("base64");

    expect(decodeWasmSize(base64)).toBe(300);
    // The base64 string is meaningfully longer than the artifact.
    expect(base64.length).toBeGreaterThan(300);
    expect(decodeWasmSize(base64)).not.toBe(base64.length);
  });

  it("tolerates the newlines that `base64` inserts when wrapping", () => {
    const bytes = Buffer.from("hello soroban wasm");
    const wrapped = bytes.toString("base64").replace(/(.{4})/g, "$1\n");
    expect(decodeWasmSize(wrapped)).toBe(bytes.length);
  });
});

describe("buildContract wasmSize", () => {
  beforeEach(() => {
    mockedExec.mockReset();
  });

  it("returns the byte length and keeps the base64 payload", async () => {
    const bytes = Buffer.from("a-very-real-wasm-artifact-payload");
    const base64 = bytes.toString("base64");

    mockedExec.mockImplementation((cmd: string) => {
      if (cmd.includes("cat ")) {
        return Promise.resolve({ stdout: base64 + "\n", stderr: "" }) as never;
      }
      if (cmd.includes("ls -la") && cmd.includes(".wasm")) {
        return Promise.resolve({ stdout: "-rw-r--r-- wasm", stderr: "" }) as never;
      }
      return Promise.resolve({ stdout: "", stderr: "" }) as never;
    });

    const result = await buildContract("G".padEnd(56, "A"), "hello_world");
    expect(result.success).toBe(true);
    if (!result.success) throw new Error("expected build success");
    expect(result.wasmBase64).toBe(base64);
    expect(result.wasmSize).toBe(bytes.length);
    expect(result.wasmSize).not.toBe(base64.length);
  });
});
