import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The project helpers shell out through docker/utils; mock it so the tests can
// assert that invalid names never reach a command. `vi.hoisted` keeps the mock
// factory (which vitest hoists above the imports) from referencing a variable
// that has not been initialised yet.
const { execAsync } = vi.hoisted(() => ({ execAsync: vi.fn() }));

vi.mock("../../lib/docker/utils", () => ({
  execAsync,
  getContainerName: (walletAddress: string) =>
    `soroban-${walletAddress.slice(0, 10).toLowerCase()}`,
  getWorkspacePath: () => "/home/developer/workspace",
  escapeShellArg: (arg: string) => `'${arg.replace(/'/g, "'\\''")}'`,
}));

import {
  createProject,
  deleteProject,
  getProject,
  isValidProjectName,
  renameProject,
} from "../../lib/projects";

const WALLET = "GBUQWP3K7EXAMPLEWALLETADDRESS0000000000000000000000000000000";

describe("isValidProjectName", () => {
  it("accepts ordinary contract names", () => {
    expect(isValidProjectName("my-contract")).toBe(true);
    expect(isValidProjectName("contract_v2")).toBe(true);
    expect(isValidProjectName("a")).toBe(true);
    expect(isValidProjectName("A1.b-c_9")).toBe(true);
  });

  it("rejects traversal, hidden, quoted, slashed and empty names", () => {
    for (const bad of [
      "../..",
      "..",
      ".stellar",
      "/etc/passwd",
      "foo/bar",
      'foo"bar',
      "foo..bar",
      "",
      "-leading-hyphen",
    ]) {
      expect(isValidProjectName(bad)).toBe(false);
    }
  });

  it("rejects non-strings and over-long names", () => {
    expect(isValidProjectName(undefined)).toBe(false);
    expect(isValidProjectName(42)).toBe(false);
    expect(isValidProjectName("a".repeat(65))).toBe(false);
  });
});

describe("project name validation guards every entry point", () => {
  const rejected = ["../..", ".stellar", "foo/bar", 'foo"bar', "", "foo..bar"];

  beforeEach(() => {
    execAsync.mockReset();
    execAsync.mockResolvedValue({ stdout: "", stderr: "" });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("createProject rejects each invalid name before running any command", async () => {
    for (const name of rejected) {
      const result = await createProject(WALLET, name);
      expect(result).toEqual({ success: false, error: "Invalid project name" });
    }
    expect(execAsync).not.toHaveBeenCalled();
  });

  it("deleteProject rejects each invalid name before running any command", async () => {
    for (const name of rejected) {
      const result = await deleteProject(WALLET, name);
      expect(result).toEqual({ success: false, error: "Invalid project name" });
    }
    expect(execAsync).not.toHaveBeenCalled();
  });

  it("getProject rejects each invalid name before running any command", async () => {
    for (const name of rejected) {
      const result = await getProject(WALLET, name);
      expect(result).toEqual({ success: false, error: "Invalid project name" });
    }
    expect(execAsync).not.toHaveBeenCalled();
  });

  it("renameProject rejects invalid old and new names before running any command", async () => {
    for (const name of rejected) {
      const result = await renameProject(WALLET, name, "ok-name");
      expect(result).toEqual({ success: false, error: "Invalid project name" });

      const result2 = await renameProject(WALLET, "ok-name", name);
      expect(result2).toEqual({ success: false, error: "Invalid project name" });
    }
    expect(execAsync).not.toHaveBeenCalled();
  });

  it("still creates, renames and deletes a valid name", async () => {
    execAsync.mockImplementation(async (cmd: string) => {
      if (cmd.includes("find")) {
        return { stdout: "\nmy-contract\n", stderr: "" };
      }
      return { stdout: "", stderr: "" };
    });

    const created = await createProject(WALLET, "my-contract");
    expect(created.success).toBe(true);
    expect(created.project?.name).toBe("my-contract");

    const renamed = await renameProject(WALLET, "my-contract", "my-other");
    expect(renamed.success).toBe(true);
    expect(renamed.project?.name).toBe("my-other");

    const deleted = await deleteProject(WALLET, "my-contract");
    expect(deleted.success).toBe(true);

    // The name is single-quoted in every docker invocation.
    const commands = execAsync.mock.calls.map((call) => String(call[0]));
    expect(
      commands.some((c) => c.includes("stellar contract init 'my-contract'"))
    ).toBe(true);
    expect(
      commands.some((c) =>
        c.includes("rm -rf '/home/developer/workspace/my-contract'")
      )
    ).toBe(true);
    expect(
      commands.some((c) =>
        c.includes(
          "mv '/home/developer/workspace/my-contract' '/home/developer/workspace/my-other'"
        )
      )
    ).toBe(true);
  });
});
