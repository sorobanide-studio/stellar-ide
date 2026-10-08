import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/docker/utils", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/docker/utils")>();
  return { ...actual, execAsync: vi.fn() };
});

import { saveFileContent } from "@/lib/docker/fileOps/write";
import { execAsync } from "@/lib/docker/utils";

const mockedExec = vi.mocked(execAsync);
const ADDRESS = "G" + "A".repeat(55);

function captureCommands() {
  const commands: string[] = [];
  mockedExec.mockImplementation((cmd: string) => {
    commands.push(cmd);
    return Promise.resolve({ stdout: "", stderr: "" }) as never;
  });
  return commands;
}

describe("saveFileContent", () => {
  beforeEach(() => {
    mockedExec.mockReset();
  });

  it("creates a file that does not exist yet", async () => {
    const commands = captureCommands();

    const result = await saveFileContent(ADDRESS, "src/new.rs", "fn main() {}", "proj");

    expect(result.success).toBe(true);
    // No `test -f` guard may reject a missing file anymore.
    expect(commands.some((c) => c.includes("test -f"))).toBe(false);
    const writeCommand = commands.find((c) => c.includes("base64 -d >"));
    expect(writeCommand).toBeDefined();
    expect(writeCommand).toContain("/home/developer/workspace/proj/src/new.rs");
  });

  it("overwrites an existing file with the supplied content", async () => {
    const commands = captureCommands();

    await saveFileContent(ADDRESS, "lib.rs", "second version", "proj");

    const writeCommand = commands.find((c) => c.includes("base64 -d >"));
    expect(writeCommand).toBeDefined();
    expect(writeCommand).toContain("/home/developer/workspace/proj/lib.rs");
    // The content is written (base64 of 'second version'), not just touched.
    const expectedBase64 = Buffer.from("second version").toString("base64");
    expect(writeCommand).toContain(expectedBase64);
  });

  it("creates the parent directory when it is missing", async () => {
    const commands = captureCommands();

    await saveFileContent(ADDRESS, "a/b/c.rs", "x", "proj");

    const mkdirCommand = commands.find(
      (c) => c.includes("mkdir -p") && c.includes("/home/developer/workspace/proj/a/b"),
    );
    expect(mkdirCommand).toBeDefined();
  });
});
