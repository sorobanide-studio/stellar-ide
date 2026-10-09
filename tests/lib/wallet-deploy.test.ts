import { describe, expect, it, vi } from "vitest";
import {
  generateDeploymentSalt,
  waitForTerminalTransaction,
} from "@/lib/wallet-deploy";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  base64ToBytes,
  bytesToHex,
  generateDeploymentSalt,
} from "../../lib/wallet-deploy";

const SALT_LENGTH = 32;

// This module runs in the browser (it is imported by the Deploy button and
// talks to @stellar/freighter-api), so it must not depend on Node's byte
// helper. Assert that at the source level rather than relying on the test
// runtime's globals.
describe("wallet-deploy is browser safe", () => {
  it("contains no Buffer identifier", () => {
    const source = readFileSync(
      fileURLToPath(new URL("../../lib/wallet-deploy.ts", import.meta.url)),
      "utf8"
    );
    expect(/\bBuffer\b/.test(source)).toBe(false);
  });
});

describe("generateDeploymentSalt", () => {
  it("always returns exactly 32 random bytes", () => {
    for (let i = 0; i < 32; i++) {
      const salt = generateDeploymentSalt();
      expect(salt).toBeInstanceOf(Uint8Array);
      expect(salt.length).toBe(SALT_LENGTH);
    }
  });

  it("produces different salts on consecutive calls (randomness is alive)", () => {
    const salts = new Set<string>();
    for (let i = 0; i < 64; i++) {
      salts.add(bytesToHex(generateDeploymentSalt()));
    }
    // 64 calls should produce 64 distinct salts — a deterministic or
    // timestamp-prefixed generator would collide.
    expect(salts.size).toBe(64);
  });

  it("does NOT start with the ASCII digits of a Date.now() timestamp", () => {
    for (let i = 0; i < 16; i++) {
      const firstFive = [...generateDeploymentSalt().slice(0, 5)];
      const allAsciiDigits = firstFive.every((b) => b >= 0x30 && b <= 0x39);
      expect(allAsciiDigits).toBe(false);
    }
  });

  it("does NOT carry the base-36 signature of Math.random()", () => {
    for (let i = 0; i < 32; i++) {
      const firstEight = [...generateDeploymentSalt().slice(0, 8)];
      const hasNonAlphanumericByte = firstEight.some(
        (b) => !(b >= 0x30 && b <= 0x39) && !(b >= 0x61 && b <= 0x7a)
      );
      if (hasNonAlphanumericByte) return;
    }
    // If every one of 32 salts looked like ASCII alphanumerics the source is
    // almost certainly Math.random().toString(36).
    throw new Error(
      "all 32 salts looked like Math.random().toString(36) output"
    );
  });
});


describe("waitForTerminalTransaction", () => {
  const server = (getTransaction: ReturnType<typeof vi.fn>) => ({ getTransaction });

  it("stops polling on the first FAILED and surfaces the resultXdr", async () => {
    const getTransaction = vi
      .fn()
      .mockResolvedValue({ status: "FAILED", resultXdr: "AAAA_FAILED_RESULT_XDR" });

    await expect(
      waitForTerminalTransaction(server(getTransaction), "hash", {
        intervalMs: 0,
        failLabel: "Upload",
      }),
    ).rejects.toThrow("AAAA_FAILED_RESULT_XDR");

    // A terminal failure must be observed exactly once — never re-polled.
    expect(getTransaction).toHaveBeenCalledTimes(1);
  });

  it("keeps polling while the transaction is NOT_FOUND and resolves on SUCCESS", async () => {
    const getTransaction = vi
      .fn()
      .mockResolvedValueOnce({ status: "NOT_FOUND" })
      .mockResolvedValueOnce({ status: "NOT_FOUND" })
      .mockResolvedValueOnce({ status: "SUCCESS", returnValue: "wasm-hash" });

    const result = await waitForTerminalTransaction(server(getTransaction), "hash", {
      intervalMs: 0,
    });

    expect(result.status).toBe("SUCCESS");
    expect(result.returnValue).toBe("wasm-hash");
    expect(getTransaction).toHaveBeenCalledTimes(3);
  });

  it("keeps polling when getTransaction rejects (transaction not yet available)", async () => {
    const getTransaction = vi
      .fn()
      .mockRejectedValueOnce(new Error("NOT_FOUND"))
      .mockResolvedValueOnce({ status: "SUCCESS" });

    const result = await waitForTerminalTransaction(server(getTransaction), "hash", {
      intervalMs: 0,
    });

    expect(result.status).toBe("SUCCESS");
    expect(getTransaction).toHaveBeenCalledTimes(2);
  });

  it("throws the timeout message when no terminal status is reached", async () => {
    const getTransaction = vi.fn().mockResolvedValue({ status: "NOT_FOUND" });

    await expect(
      waitForTerminalTransaction(server(getTransaction), "hash", {
        maxAttempts: 3,
        intervalMs: 0,
        timeoutMessage: "WASM upload timeout",
      }),
    ).rejects.toThrow("WASM upload timeout");

    expect(getTransaction).toHaveBeenCalledTimes(3);
describe("base64ToBytes", () => {
  it("decodes a known fixture to the same bytes as before", () => {
    // "hello" in base64 is "aGVsbG8=".
    expect([...base64ToBytes("aGVsbG8=")]).toEqual([104, 101, 108, 108, 111]);
  });

  it("decodes an empty string to an empty array", () => {
    expect([...base64ToBytes("")]).toEqual([]);
  });
});

describe("bytesToHex", () => {
  it("encodes bytes as lower-case hex", () => {
    expect(bytesToHex(new Uint8Array([0, 15, 16, 255]))).toBe("000f10ff");
  });

  it("keeps the hash prefix format stable", () => {
    const hash = new Uint8Array([
      0xde, 0xad, 0xbe, 0xef, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12,
    ]);
    expect(bytesToHex(hash).slice(0, 16)).toBe("deadbeef01020304");
  });
});
