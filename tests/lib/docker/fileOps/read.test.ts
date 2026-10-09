import { beforeEach, describe, expect, it, vi } from "vitest";

const { execAsyncMock } = vi.hoisted(() => ({ execAsyncMock: vi.fn() }));

vi.mock("../../../../lib/docker/utils", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../../../../lib/docker/utils")>();
  return { ...actual, execAsync: execAsyncMock };
});

import {
  getContainerFiles,
  getFileContent,
} from "../../../../lib/docker/fileOps/read";

const WALLET = "GBUQWP3KABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const CONTAINER = "soroban-gbuqwp3kab";
const WORKSPACE = "/home/developer/workspace";
const PROJECT = "my-proj";
const BASE = `${WORKSPACE}/${PROJECT}`;

function ok(stdout: string) {
  return { stdout, stderr: "" };
}

function commands(): string[] {
  return execAsyncMock.mock.calls.map((call) => String(call[0]));
}

beforeEach(() => {
  execAsyncMock.mockReset();
});

describe("getContainerFiles", () => {
  it("strips the search prefix from find output and keeps normal files", async () => {
    execAsyncMock.mockResolvedValueOnce(ok("true")); // container running
    execAsyncMock.mockResolvedValueOnce(ok("exists")); // project exists
    execAsyncMock.mockResolvedValueOnce(
      ok(
        [
          `${BASE}/src/lib.rs`,
          `${BASE}/Cargo.toml`,
          `${BASE}/README.md`,
        ].join("\n"),
      ),
    );

    const result = await getContainerFiles(WALLET, PROJECT);

    expect(result).toEqual({
      success: true,
      files: ["src/lib.rs", "Cargo.toml", "README.md"],
    });
    expect(commands()).toEqual([
      `docker inspect -f '{{.State.Running}}' ${CONTAINER} 2>/dev/null || echo "false"`,
      `docker exec ${CONTAINER} test -d ${BASE} && echo "exists" || echo "missing"`,
      `docker exec ${CONTAINER} find ${BASE} -type f 2>/dev/null`,
    ]);
  });

  it("filters /target/, /.git/, Cargo.lock and projects.json", async () => {
    execAsyncMock.mockResolvedValueOnce(ok("true"));
    execAsyncMock.mockResolvedValueOnce(ok("exists"));
    execAsyncMock.mockResolvedValueOnce(
      ok(
        [
          `${BASE}/src/lib.rs`,
          `${BASE}/crate/target/debug/libhello.rlib`, // contains /target/
          `${BASE}/crate/.git/config`, // contains /.git/
          `${BASE}/Cargo.lock`,
          `${BASE}/projects.json`,
          `${BASE}/README.md`,
        ].join("\n"),
      ),
    );

    const result = await getContainerFiles(WALLET, PROJECT);

    expect(result).toEqual({
      success: true,
      files: ["src/lib.rs", "README.md"],
    });
  });

  it("returns an empty list when the project directory is missing", async () => {
    execAsyncMock.mockResolvedValueOnce(ok("true")); // container running
    execAsyncMock.mockResolvedValueOnce(ok("missing")); // project missing

    const result = await getContainerFiles(WALLET, PROJECT);

    expect(result).toEqual({
      success: true,
      files: [],
      message: `Project ${PROJECT} not found`,
    });
  });

  it("prompts for a project when no projectName is given", async () => {
    execAsyncMock.mockResolvedValueOnce(ok("true"));

    const result = await getContainerFiles(WALLET);

    expect(result).toEqual({
      success: true,
      files: [],
      message: "Please select a project to open",
    });
    expect(commands()).toHaveLength(1);
  });

  it("fails when the container is not running", async () => {
    execAsyncMock.mockResolvedValueOnce(ok("false"));

    const result = await getContainerFiles(WALLET, PROJECT);

    expect(result).toEqual({
      success: false,
      error: "Container is not running",
      files: [],
    });
  });
});

describe("getFileContent", () => {
  it("builds the exact cat command for a nested file", async () => {
    execAsyncMock.mockResolvedValueOnce(ok("exists"));
    execAsyncMock.mockResolvedValueOnce(ok("fn main() {}\n"));

    const result = await getFileContent(WALLET, "src/lib.rs", PROJECT);

    expect(result).toEqual({ success: true, content: "fn main() {}\n" });
    expect(commands()).toEqual([
      `docker exec ${CONTAINER} test -f ${BASE}/src/lib.rs && echo "exists" || echo "missing"`,
      `docker exec ${CONTAINER} cat ${BASE}/src/lib.rs`,
    ]);
  });

  it("builds the exact cat command for a top-level file", async () => {
    execAsyncMock.mockResolvedValueOnce(ok("exists"));
    execAsyncMock.mockResolvedValueOnce(ok("hello"));

    await getFileContent(WALLET, "README.md", PROJECT);

    expect(commands()).toEqual([
      `docker exec ${CONTAINER} test -f ${BASE}/README.md && echo "exists" || echo "missing"`,
      `docker exec ${CONTAINER} cat ${BASE}/README.md`,
    ]);
  });

  it("emits an unquoted path for a filename containing a space (documents the quoting bug)", async () => {
    execAsyncMock.mockResolvedValueOnce(ok("exists"));
    execAsyncMock.mockResolvedValueOnce(ok("data"));

    await getFileContent(WALLET, "src/my file.rs", PROJECT);

    // The path is interpolated raw, so the shell sees two arguments and the
    // command is broken. The test pins the current behaviour deliberately.
    expect(commands()[0]).toBe(
      `docker exec ${CONTAINER} test -f ${BASE}/src/my file.rs && echo "exists" || echo "missing"`,
    );
    expect(commands()[0]).not.toContain("'");
    expect(commands()[1]).toBe(`docker exec ${CONTAINER} cat ${BASE}/src/my file.rs`);
  });

  it("reports a failure when the file does not exist", async () => {
    execAsyncMock.mockResolvedValueOnce(ok("missing"));

    const result = await getFileContent(WALLET, "src/lib.rs", PROJECT);

    expect(result).toEqual({
      success: false,
      error: `File does not exist at ${BASE}/src/lib.rs`,
      content: "",
    });
  });

  it("requires a project name and never shell-outs without one", async () => {
    const result = await getFileContent(WALLET, "src/lib.rs");

    expect(result).toEqual({
      success: false,
      error: "Project name is required",
      content: "",
    });
    expect(execAsyncMock).not.toHaveBeenCalled();
  });
});
