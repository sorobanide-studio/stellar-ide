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
