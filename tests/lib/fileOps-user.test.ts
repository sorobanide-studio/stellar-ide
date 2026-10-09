import { describe, expect, it } from "vitest";
import {
  FILE_OPS_USER,
  buildFindByNameCommand,
  buildMkdirCommand,
  buildReadFileCommand,
  buildRemoveFileCommand,
  buildRemoveFolderCommand,
  buildTestDirCommand,
  buildTestFileCommand,
  buildTouchFileCommand,
  buildWriteFileCommand,
} from "../../lib/docker/fileOps/commands";

const CONTAINER = "soroban-gbuqwp3k";
const FILE = "/home/developer/workspace/demo/src/lib.rs";
const DIR = "/home/developer/workspace/demo/src";

describe("file operations run as the unprivileged developer user", () => {
  it("pins the unprivileged user", () => {
    expect(FILE_OPS_USER).toBe("developer");
  });

  const commands: Array<[string, string]> = [
    ["read file", buildReadFileCommand(CONTAINER, FILE)],
    ["write file", buildWriteFileCommand(CONTAINER, FILE, "aGVsbG8=")],
    ["create empty file", buildTouchFileCommand(CONTAINER, FILE)],
    ["create directory", buildMkdirCommand(CONTAINER, DIR)],
    ["delete file", buildRemoveFileCommand(CONTAINER, FILE)],
    ["delete folder", buildRemoveFolderCommand(CONTAINER, DIR)],
    ["test file", buildTestFileCommand(CONTAINER, FILE)],
    ["test dir", buildTestDirCommand(CONTAINER, DIR)],
    ["find by name", buildFindByNameCommand(CONTAINER, DIR, "lib.rs")],
  ];

  it.each(commands)("%s command specifies -u developer", (_label, cmd) => {
    expect(cmd).toContain("docker exec -u developer");
  });

  it("write path uses the developer user and base64 piping", () => {
    const cmd = buildWriteFileCommand(CONTAINER, FILE, "aGVsbG8=");
    expect(cmd).toContain("-u developer");
    expect(cmd).toContain("base64 -d");
    expect(cmd).toContain(FILE);
  });
});
