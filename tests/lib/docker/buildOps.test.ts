import { beforeEach, describe, expect, it, vi } from "vitest";

const { execAsyncMock } = vi.hoisted(() => ({ execAsyncMock: vi.fn() }));

vi.mock("../../../lib/docker/utils", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../../../lib/docker/utils")>();
  return { ...actual, execAsync: execAsyncMock };
});

import {
  buildContract,
  cleanBuild,
  getContractBuildStatus,
} from "../../../lib/docker/buildOps";

const WALLET = "GBUQWP3KABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const CONTAINER = "soroban-gbuqwp3kab";
const WORKSPACE = "/home/developer/workspace";

function ok(stdout: string) {
  return { stdout, stderr: "" };
}

function commands(): string[] {
  return execAsyncMock.mock.calls.map((call) => String(call[0]));
}

/**
 * Queue the seven execAsync responses a successful buildContract() needs, in
 * the order the module issues them.
 */
function queueSuccessfulBuild(base64: string) {
  execAsyncMock.mockResolvedValueOnce(ok("")); // STEP 0: rm wasm artifacts
  execAsyncMock.mockResolvedValueOnce(ok("Cargo.toml\n")); // ls project dir
  execAsyncMock.mockResolvedValueOnce(ok("")); // stellar contract build
  execAsyncMock.mockResolvedValueOnce(ok("")); // cargo build
  execAsyncMock.mockResolvedValueOnce(ok("")); // find target
  execAsyncMock.mockResolvedValueOnce(ok("-rw-r--r-- 1 developer developer 1234 x.wasm")); // ls wasm
  execAsyncMock.mockResolvedValueOnce(ok(base64)); // cat wasm | base64
}

beforeEach(() => {
  execAsyncMock.mockReset();
});

describe("buildContract", () => {
  it("derives the wasm path from the project name (never hard-codes hello_world.wasm)", async () => {
    const binary = Buffer.from([0, 1, 2, 3, 4, 250, 255, 16, 32]);
    const base64 = binary.toString("base64");
    queueSuccessfulBuild(`  ${base64}\n`);

    const result = await buildContract(WALLET, "my-contract");

    const allCommands = commands().join("\n");
    expect(allCommands).not.toContain("hello_world.wasm");
    expect(allCommands).toContain(
      `${WORKSPACE}/my-contract/target/wasm32v1-none/release/my_contract.wasm`,
    );
    if (!result.success) throw new Error(result.error);
    expect(result.wasmBase64).toBe(base64);
  });

  it("derives a different wasm path for a different project name", async () => {
    const binary = Buffer.from([9, 8, 7, 6]);
    const base64 = binary.toString("base64");

    queueSuccessfulBuild(base64);
    await buildContract(WALLET, "alpha");

    queueSuccessfulBuild(base64);
    await buildContract(WALLET, "beta-2");

    const allCommands = commands().join("\n");
    expect(allCommands).toContain(
      `${WORKSPACE}/alpha/target/wasm32v1-none/release/alpha.wasm`,
    );
    expect(allCommands).toContain(
      `${WORKSPACE}/beta-2/target/wasm32v1-none/release/beta_2.wasm`,
    );
  });

  it("reports wasmSize as the decoded byte length, not the base64 length", async () => {
    const binary = Buffer.from([0, 1, 2, 3, 4, 250, 255, 16, 32]); // 9 bytes
    const base64 = binary.toString("base64"); // 12 chars
    queueSuccessfulBuild(base64);

    const result = await buildContract(WALLET, "my-contract");

    if (!result.success) throw new Error(result.error);
    expect(result.wasmSize).toBe(binary.length);
    expect(result.wasmSize).not.toBe(base64.length);
    expect(result.wasmSize).toBe(9);
    expect(base64.length).toBe(12);
  });

  it("surfaces a build failure when the wasm file is missing", async () => {
    execAsyncMock.mockResolvedValueOnce(ok(""));
    execAsyncMock.mockResolvedValueOnce(ok("Cargo.toml\n"));
    execAsyncMock.mockResolvedValueOnce(ok(""));
    execAsyncMock.mockResolvedValueOnce(ok(""));
    execAsyncMock.mockResolvedValueOnce(ok(""));
    execAsyncMock.mockResolvedValueOnce(ok("WASM file not found"));

    const result = await buildContract(WALLET, "my-contract");

    expect(result.success).toBe(false);
    expect(result.error).toContain("WASM file not created");
  });
});

describe("getContractBuildStatus", () => {
  it("reports isBuilt: false when test -f prints missing", async () => {
    execAsyncMock.mockResolvedValueOnce(ok("missing"));

    const result = await getContractBuildStatus(WALLET, "my-contract");

    expect(result).toEqual({
      success: true,
      isBuilt: false,
      message: "Contract has not been built yet",
    });
    expect(commands()[0]).toBe(
      `docker exec ${CONTAINER} test -f ${WORKSPACE}/my-contract/target/wasm32v1-none/release/my_contract.wasm && echo "exists" || echo "missing"`,
    );
  });

  it("reports isBuilt: true with the human-readable wasm size", async () => {
    execAsyncMock.mockResolvedValueOnce(ok("exists"));
    execAsyncMock.mockResolvedValueOnce(ok("12K"));

    const result = await getContractBuildStatus(WALLET, "my-contract");

    expect(result).toEqual({
      success: true,
      isBuilt: true,
      wasmSize: "12K",
      message: "Contract has been built",
    });
  });
});

describe("cleanBuild", () => {
  it("runs cargo clean inside the project directory only", async () => {
    execAsyncMock.mockResolvedValueOnce(ok(""));

    const result = await cleanBuild(WALLET, "my-contract");

    expect(result).toEqual({
      success: true,
      message: "Build artifacts cleaned successfully",
    });
    expect(commands()).toEqual([
      `docker exec -u developer -w ${WORKSPACE}/my-contract ${CONTAINER} sh -c "cargo clean"`,
    ]);
  });
});
