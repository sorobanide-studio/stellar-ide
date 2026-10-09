import { describe, expect, it } from "vitest";
import { escapeFilePath } from "@/lib/docker/utils";

describe("escapeFilePath", () => {
  it("resolves interior '..' instead of deleting the characters", () => {
    expect(escapeFilePath("a/../b")).toBe("b");
    expect(escapeFilePath("a/b/../../c")).toBe("c");
  });

  it("resolves '.' segments and keeps a normal relative path", () => {
    expect(escapeFilePath("./src/./lib.rs")).toBe("src/lib.rs");
    expect(escapeFilePath("src/lib.rs")).toBe("src/lib.rs");
  });

  it.each(["..", "../", "./", "/", "", "a/../../b", "C:/tmp", "src/../../../etc/passwd"])(
    "rejects the root-escaping / absolute path %o",
    (bad) => {
      expect(() => escapeFilePath(bad)).toThrow();
    },
  );

  it("rejects the project-root path '..' rather than returning empty string", () => {
    // The old implementation returned '' for '..', which made callers build
    // `${basePath}/` — the project directory itself (and `rm -rf` it).
    expect(() => escapeFilePath("..")).toThrow(/escapes the project root/);
  });
});
