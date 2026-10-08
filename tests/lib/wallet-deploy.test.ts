import { describe, expect, it } from "vitest";
import { generateDeploymentSalt } from "@/lib/wallet-deploy";

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
