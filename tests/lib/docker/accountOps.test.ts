import { beforeEach, describe, expect, it, vi } from "vitest";

const { execAsyncMock } = vi.hoisted(() => ({ execAsyncMock: vi.fn() }));

vi.mock("../../../lib/docker/utils", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../../../lib/docker/utils")>();
  return { ...actual, execAsync: execAsyncMock };
});

import {
  backupCredentials,
  createAccount,
  generateKeys,
  getAccountStatus,
} from "../../../lib/docker/accountOps";

const WALLET = "GBUQWP3KABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const CONTAINER = "soroban-gbuqwp3kab";
const PROJECT_PATH = "/home/developer/workspace/soroban-hello-world";

function ok(stdout: string) {
  return { stdout, stderr: "" };
}

function commands(): string[] {
  return execAsyncMock.mock.calls.map((call) => String(call[0]));
}

beforeEach(() => {
  execAsyncMock.mockReset();
});

describe("createAccount", () => {
  it("generates and funds the fixed darshan identity, then backs up .config", async () => {
    execAsyncMock.mockResolvedValueOnce(ok("account created"));
    execAsyncMock.mockResolvedValueOnce(ok(""));

    const result = await createAccount(WALLET);

    expect(commands()[0]).toBe(
      `docker exec -u developer ${CONTAINER} sh -c "stellar keys generate darshan --network testnet --fund"`,
    );
    expect(commands()[1]).toBe(
      `docker exec ${CONTAINER} cp -r /home/developer/.config ${PROJECT_PATH}/.config`,
    );
    expect(result).toEqual({
      success: true,
      stdout: "account created",
      stderr: "",
      message: "Account created and credentials backed up",
    });
  });

  it("still succeeds when the .config copy fails", async () => {
    execAsyncMock.mockResolvedValueOnce(ok("account created"));
    execAsyncMock.mockRejectedValueOnce(new Error("cp: permission denied"));

    const result = await createAccount(WALLET);

    expect(result.success).toBe(true);
    expect(result.stdout).toBe("account created");
    expect(result.message).toBe("Account created and credentials backed up");
  });

  it("uses the darshan identity in the command string", async () => {
    execAsyncMock.mockResolvedValueOnce(ok("ok"));
    execAsyncMock.mockResolvedValueOnce(ok(""));

    await createAccount(WALLET);

    expect(commands()[0]).toContain("stellar keys generate darshan");
  });
});

describe("generateKeys", () => {
  it("defaults to the darshan identity and funds it", async () => {
    execAsyncMock.mockResolvedValueOnce(ok("ok"));

    const result = await generateKeys(WALLET);

    expect(commands()[0]).toBe(
      `docker exec -u developer ${CONTAINER} sh -c "stellar keys generate darshan --network testnet --fund"`,
    );
    expect(result.message).toBe("Keys generated for darshan");
  });

  it("honours a caller-supplied key name", async () => {
    execAsyncMock.mockResolvedValueOnce(ok("ok"));

    const result = await generateKeys(WALLET, "alice");

    expect(commands()[0]).toContain("stellar keys generate alice");
    expect(result.message).toBe("Keys generated for alice");
  });
});

describe("getAccountStatus", () => {
  it("reports accountExists: false when the identity check prints missing", async () => {
    execAsyncMock.mockResolvedValueOnce(ok("missing"));

    const result = await getAccountStatus(WALLET);

    expect(result).toEqual({
      success: true,
      accountExists: false,
      message: "Account darshan does not exist",
    });
    expect(commands()[0]).toBe(
      `docker exec ${CONTAINER} test -f /home/developer/.config/soroban/identities/darshan && echo "exists" || echo "missing"`,
    );
  });

  it("reports the balance when the identity exists", async () => {
    execAsyncMock.mockResolvedValueOnce(ok("exists"));
    execAsyncMock.mockResolvedValueOnce(ok("1000 XLM"));

    const result = await getAccountStatus(WALLET);

    expect(result).toEqual({
      success: true,
      accountExists: true,
      balance: "1000 XLM",
      message: "Account darshan exists",
    });
    expect(commands()[1]).toContain("stellar account info darshan");
  });
});

describe("backupCredentials", () => {
  it("copies .config into the project path with no node_modules in the command", async () => {
    execAsyncMock.mockResolvedValueOnce(ok(""));

    const result = await backupCredentials(WALLET);

    expect(commands()[0]).toBe(
      `docker exec ${CONTAINER} cp -r /home/developer/.config ${PROJECT_PATH}/.config`,
    );
    expect(commands()[0]).not.toContain("node_modules");
    expect(result).toEqual({
      success: true,
      message: "Credentials backed up successfully",
    });
  });
});
