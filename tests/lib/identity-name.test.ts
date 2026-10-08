import { describe, expect, it } from "vitest";
import { getContainerName, getIdentityName } from "../../lib/docker/utils";

describe("per-wallet Stellar identity", () => {
  const wallet =
    "GBUQWP3KD3N6EMVMB3Z6P2PRHRG7H6NKF3QVJ7M3Q5H2DPYH7GZ7DEMO";

  it("derives the identity name from the wallet address", () => {
    expect(getIdentityName(wallet)).toBe("stellar-gbuqwp3kd");
  });

  it("mirrors the container-name prefix so one wallet maps to one identity", () => {
    const prefix = getContainerName(wallet).replace("soroban-", "");
    expect(getIdentityName(wallet)).toBe(`stellar-${prefix}`);
  });

  it("gives two different wallets two different identities", () => {
    const a = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";
    const b = "GBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBWHF";
    expect(getIdentityName(a)).not.toBe(getIdentityName(b));
  });
});
