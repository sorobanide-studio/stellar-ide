import { describe, expect, it } from "vitest";
import * as StellarSdk from "@stellar/stellar-sdk";
import {
  generateDeploymentSalt,
  parseContractIdFromReturnValue,
} from "../../lib/wallet-deploy";

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
    // prefix — sample 16 salts and assert none starts with 5 ASCII digits.
    for (let i = 0; i < 16; i++) {
      const salt = generateDeploymentSalt();
      const firstFive = salt.subarray(0, 5);
      const allAsciiDigits = [...firstFive].every(
        (b) => b >= 0x30 && b <= 0x39,
      );
      expect(allAsciiDigits).toBe(false);
    }
  });
});

describe("parseContractIdFromReturnValue", () => {
  it("decodes an ScVal address into its StrKey representation", () => {
    const keypair = StellarSdk.Keypair.random();
    const address = new StellarSdk.Address(keypair.publicKey());
    const scAddress = address.toScAddress();

    const returnValue = {
      address: () => scAddress,
      // A "useless" toString must not win over the decodable address.
      toString: () => "[object Object]",
    };

    expect(parseContractIdFromReturnValue(returnValue)).toBe(
      keypair.publicKey(),
    );
  });

  it("falls back to \"unknown\" when there is no .address() and toString() is useless", () => {
    expect(
      parseContractIdFromReturnValue({ toString: () => "[object Object]" }),
    ).toBe("unknown");
  });

  it("falls back to \"unknown\" for a plain object with no usable accessors", () => {
    expect(parseContractIdFromReturnValue({})).toBe("unknown");
  });

  it("falls back to \"unknown\" for null and undefined", () => {
    expect(parseContractIdFromReturnValue(null)).toBe("unknown");
    expect(parseContractIdFromReturnValue(undefined)).toBe("unknown");
  });

  it("falls back to \"unknown\" when .address() throws instead of surfacing an error", () => {
    const returnValue = {
      address: () => {
        throw new Error("cannot decode scval");
      },
    };

    expect(parseContractIdFromReturnValue(returnValue)).toBe("unknown");
  });
});
