import { describe, expect, it } from "vitest";
import * as barrel from "../../../../lib/docker/fileOps/index";
import * as read from "../../../../lib/docker/fileOps/read";
import * as write from "../../../../lib/docker/fileOps/write";
import * as deleteOps from "../../../../lib/docker/fileOps/delete";

const EXPECTED_FUNCTIONS = [
  "createFile",
  "createFolder",
  "deleteFile",
  "deleteFolder",
  "getContainerFiles",
  "getFileContent",
  "saveFileContent",
];

function functionNames(mod: unknown): string[] {
  const record = mod as Record<string, unknown>;
  return Object.keys(record)
    .filter((key) => typeof record[key] === "function")
    .sort();
}

describe("lib/docker/fileOps barrel", () => {
  it("exposes every file operation as a function", () => {
    const record = barrel as unknown as Record<string, unknown>;

    for (const name of EXPECTED_FUNCTIONS) {
      expect(typeof record[name], `missing export: ${name}`).toBe("function");
    }
  });

  it("re-exports exactly the functions defined by read/write/delete", () => {
    const underlying = [
      ...functionNames(read),
      ...functionNames(write),
      ...functionNames(deleteOps),
    ].sort();

    const exported = functionNames(barrel);

    // Nothing extra is exposed …
    expect(exported).toEqual(underlying);
    // … and nothing the underlying modules define is dropped.
    expect(new Set(exported)).toEqual(new Set(EXPECTED_FUNCTIONS));
  });

  it("snapshots the module's exported key set", () => {
    expect(Object.keys(barrel).sort()).toEqual([
      "createFile",
      "createFolder",
      "deleteFile",
      "deleteFolder",
      "getContainerFiles",
      "getFileContent",
      "saveFileContent",
    ]);
  });
});
