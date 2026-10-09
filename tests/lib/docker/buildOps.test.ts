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
import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  getWasmFileName,
  getWasmPath,
  getWasmDepsPath,
  getWasmRelativePath,
  resolveProjectDirectory,
} from "@/lib/docker/utils";
import { buildContract, getContractBuildStatus } from "@/lib/docker/buildOps";

vi.mock("@/lib/docker/utils", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/docker/utils")>();
  return { ...actual, execAsync: vi.fn() };
});

import { execAsync } from "@/lib/docker/utils";

const mockedExec = vi.mocked(execAsync);

describe("wasm path helpers", () => {
  it("derives the wasm name from two different project names", () => {
    expect(getWasmFileName("hello_world")).toBe("hello_world.wasm");
    expect(getWasmFileName("my-contract")).toBe("my_contract.wasm");
    expect(getWasmFileName("my_second_project")).toBe("my_second_project.wasm");
  });

  it("never falls back to hello_world.wasm for another project", () => {
    const dir = "/home/developer/workspace/my-contract";
    expect(getWasmPath(dir, "my-contract")).toBe(
      "/home/developer/workspace/my-contract/target/wasm32v1-none/release/my_contract.wasm",
    );
    expect(getWasmDepsPath(dir, "my-contract")).toBe(
      "/home/developer/workspace/my-contract/target/wasm32v1-none/release/deps/my_contract.wasm",
    );
    expect(getWasmRelativePath("my-contract")).toBe(
      "target/wasm32v1-none/release/my_contract.wasm",
    );
  });

  it("resolves the project directory from the project name", () => {
    expect(resolveProjectDirectory("my-contract")).toBe(
      "/home/developer/workspace/my-contract",
    );
    expect(resolveProjectDirectory()).toBe(
      "/home/developer/workspace/soroban-hello-world",
    );
  });
});

describe("buildContract / getContractBuildStatus use the resolved wasm path", () => {
  beforeEach(() => {
    mockedExec.mockReset();
  });

  it("builds a project named my-contract against my_contract.wasm", async () => {
    const wasmBytes = Buffer.from("fake-wasm-bytes");
    const commands: string[] = [];
    mockedExec.mockImplementation((cmd: string) => {
      commands.push(cmd);
      if (cmd.includes("cat ")) {
        return Promise.resolve({ stdout: wasmBytes.toString("base64") + "\n", stderr: "" }) as never;
      }
      if (cmd.includes("ls -la") && cmd.includes(".wasm")) {
        return Promise.resolve({ stdout: "-rw-r--r-- 1 dev dev 14 my_contract.wasm", stderr: "" }) as never;
      }
      return Promise.resolve({ stdout: "", stderr: "" }) as never;
    });

    const result = await buildContract("G".padEnd(56, "A"), "my-contract");
    expect(result.success).toBe(true);
    const wrote = commands.find((c) => c.includes("cat ") && c.includes("base64"));
    expect(wrote).toBeDefined();
    expect(wrote).toContain("my_contract.wasm");
    expect(commands.some((c) => c.includes("hello_world.wasm"))).toBe(false);
  });

  it("checks the status of a project named other_project against other_project.wasm", async () => {
    const commands: string[] = [];
    mockedExec.mockImplementation((cmd: string) => {
      commands.push(cmd);
      return Promise.resolve({ stdout: "missing", stderr: "" }) as never;
    });

    await getContractBuildStatus("G".padEnd(56, "A"), "other_project");
    const check = commands.find((c) => c.includes("test -f"));
    expect(check).toBeDefined();
    expect(check).toContain("other_project.wasm");
    expect(check).not.toContain("hello_world.wasm");
  });
});
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
