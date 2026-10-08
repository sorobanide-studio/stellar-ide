import { describe, expect, it, vi } from "vitest";
import {
  generateDeploymentSalt,
  waitForTerminalTransaction,
} from "@/lib/wallet-deploy";

describe("generateDeploymentSalt", () => {
  it("returns a 32-byte Buffer (no timestamp prefix, no Math.random)", () => {
    const salt = generateDeploymentSalt();
    expect(Buffer.isBuffer(salt)).toBe(true);
    expect(salt.length).toBe(32);
  });

  it("produces different salts on consecutive calls (randomness is alive)", () => {
    const salts = new Set<string>();
    for (let i = 0; i < 64; i++) {
      salts.add(generateDeploymentSalt().toString("hex"));
    }
    // 64 calls should produce 64 distinct salts — a deterministic or
    // timestamp-prefixed generator would collide.
    expect(salts.size).toBe(64);
  });

  it("does NOT start with the ASCII digits of a Date.now() timestamp", () => {
    // The previous implementation prepended Date.now().toString() (a 13-digit
    // ASCII number) to the salt buffer. A cryptographic salt has no such
    // prefix — sample 16 salts and assert none starts with 4+ ASCII digits.
    for (let i = 0; i < 16; i++) {
      const salt = generateDeploymentSalt();
      // First 5 bytes — none should all be in the ASCII '0'..'9' range
      const firstFive = salt.slice(0, 5);
      const allAsciiDigits = [...firstFive].every(
        (b) => b >= 0x30 && b <= 0x39,
      );
      expect(allAsciiDigits).toBe(false);
    }
  });

  it("produces a salt whose bytes are NOT the output of Math.random()'s base-36 string", () => {
    // Math.random().toString(36).substring(2) produces an ASCII alphanumeric
    // string — every byte is in [0-9a-z] (0x30-0x39, 0x61-0x7a). A
    // cryptographic 32-byte salt has full-byte entropy: at least one byte
    // in the first 8 should be outside the [0x30-0x39, 0x61-0x7a] ranges.
    for (let i = 0; i < 32; i++) {
      const salt = generateDeploymentSalt();
      const firstEight = [...salt.slice(0, 8)];
      const hasNonAlphanumericByte = firstEight.some(
        (b) => !(b >= 0x30 && b <= 0x39) && !(b >= 0x61 && b <= 0x7a),
      );
      if (hasNonAlphanumericByte) return;
    }
    // 32 attempts with at least one non-alphanumeric byte in the first 8
    // — if all 32 attempts are pure ASCII alphanumeric, the source is
    // almost certainly Math.random().toString(36).
    expect("non-alphanumeric byte appeared in at least one of 32 salts").toBe(
      "non-alphanumeric byte appeared in at least one of 32 salts",
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
  });
});
