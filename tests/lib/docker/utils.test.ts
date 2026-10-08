import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import {
  escapeFilePath,
  escapeShellArg,
  formatDockerError,
  getContainerName,
  getProjectPath,
  getWorkspacePath,
} from "../../../lib/docker/utils";

/**
 * Re-read an escaped argument through a POSIX shell and return exactly what
 * the shell would pass to the command (printf %s prints the argument raw).
 */
function shellRoundTrip(escaped: string): string {
  return execFileSync("/bin/sh", ["-c", `printf %s ${escaped}`], {
    encoding: "utf8",
  });
}

describe("getContainerName", () => {
  it("lowercases and uses the first 10 characters of the wallet address", () => {
    expect(getContainerName("GBUQWP3KABCDEFGHIJKLMNOPQRSTUVWXYZ234567")).toBe(
      "soroban-gbuqwp3kab",
    );
  });

  it("handles mixed-case input by lowercasing the prefix", () => {
    expect(getContainerName("GbUqWp3kAbCdEf")).toBe("soroban-gbuqwp3kab");
  });

  it("does not pad short inputs", () => {
    expect(getContainerName("abc")).toBe("soroban-abc");
  });
});

describe("escapeShellArg", () => {
  it("wraps a simple argument in single quotes", () => {
    expect(escapeShellArg("hello")).toBe("'hello'");
  });

  it("escapes an embedded single quote", () => {
    expect(escapeShellArg("it's")).toBe("'it'\\''s'");
  });

  it("produces a string a POSIX shell re-reads as the original argument", () => {
    const original = "it's a 'quoted' value";
    expect(shellRoundTrip(escapeShellArg(original))).toBe(original);
  });
});

describe("escapeFilePath", () => {
  it("strips a leading slash", () => {
    expect(escapeFilePath("/etc/passwd")).toBe("etc/passwd");
  });

  it("strips all leading slashes", () => {
    expect(escapeFilePath("///etc/passwd")).toBe("etc/passwd");
  });

  it("removes every '..' occurrence, even in the middle of a legit path", () => {
    // Documents the current contract: 'a/../b' becomes 'a//b' (the '..' is
    // deleted rather than resolving the path).
    expect(escapeFilePath("a/../b")).toBe("a//b");
  });

  it("collapses '/', '..' and './'-style traversal inputs", () => {
    expect(escapeFilePath("/")).toBe("");
    expect(escapeFilePath("..")).toBe("");
    expect(escapeFilePath("./")).toBe("./");
  });

  it("leaves a normal relative path untouched", () => {
    expect(escapeFilePath("src/lib.rs")).toBe("src/lib.rs");
  });
});

describe("path constants", () => {
  it("returns the container project and workspace paths", () => {
    expect(getProjectPath()).toBe("/home/developer/workspace/soroban-hello-world");
    expect(getWorkspacePath()).toBe("/home/developer/workspace");
  });
});

describe("formatDockerError", () => {
  it("returns the trimmed output when present", () => {
    expect(formatDockerError("  boom  ")).toBe("boom");
  });

  it("returns 'Unknown Docker error' for whitespace-only input", () => {
    expect(formatDockerError("   \n\t ")).toBe("Unknown Docker error");
  });

  it("returns 'Unknown Docker error' for empty input", () => {
    expect(formatDockerError("")).toBe("Unknown Docker error");
  });
});
