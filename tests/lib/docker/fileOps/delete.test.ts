import { beforeEach, describe, expect, it, vi } from "vitest";

const { execAsyncMock } = vi.hoisted(() => ({ execAsyncMock: vi.fn() }));

vi.mock("../../../../lib/docker/utils", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../../../../lib/docker/utils")>();
  return { ...actual, execAsync: execAsyncMock };
});

import {
  deleteFile,
  deleteFolder,
} from "../../../../lib/docker/fileOps/delete";

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

describe("deleteFile", () => {
  it("guards with test -f before running rm (no -rf)", async () => {
    execAsyncMock.mockResolvedValueOnce(ok("exists"));
    execAsyncMock.mockResolvedValueOnce(ok(""));

    const result = await deleteFile(WALLET, "src/old.rs", PROJECT);

    expect(result).toEqual({
      success: true,
      message: "File src/old.rs deleted",
    });
    expect(commands()).toEqual([
      `docker exec ${CONTAINER} test -f ${BASE}/src/old.rs && echo "exists" || echo "missing"`,
      `docker exec -u developer ${CONTAINER} rm ${BASE}/src/old.rs`,
    ]);
    expect(commands()[1]).not.toContain("-rf");
  });

  it("returns the guard error instead of falling through to rm", async () => {
    execAsyncMock.mockResolvedValueOnce(ok("missing"));

    const result = await deleteFile(WALLET, "src/old.rs", PROJECT);

    expect(result).toEqual({
      success: false,
      error: `File does not exist: ${BASE}/src/old.rs`,
    });
    expect(execAsyncMock).toHaveBeenCalledTimes(1); // guard only, never rm
  });
});

describe("deleteFolder", () => {
  it("guards with test -d then runs rm -rf", async () => {
    execAsyncMock.mockResolvedValueOnce(ok("exists"));
    execAsyncMock.mockResolvedValueOnce(ok(""));

    const result = await deleteFolder(WALLET, "src", PROJECT);

    expect(result).toEqual({
      success: true,
      message: "Folder src deleted",
    });
    expect(commands()).toEqual([
      `docker exec ${CONTAINER} test -d ${BASE}/src && echo "exists" || echo "missing"`,
      `docker exec -u developer ${CONTAINER} rm -rf ${BASE}/src`,
    ]);
  });

  it("returns the guard error instead of falling through to rm -rf", async () => {
    execAsyncMock.mockResolvedValueOnce(ok("missing"));

    const result = await deleteFolder(WALLET, "src", PROJECT);

    expect(result).toEqual({
      success: false,
      error: `Folder does not exist: ${BASE}/src`,
    });
    expect(execAsyncMock).toHaveBeenCalledTimes(1);
  });

  it("collapses '/' to the project directory itself and hands it to rm -rf", async () => {
    execAsyncMock.mockResolvedValueOnce(ok("exists"));
    execAsyncMock.mockResolvedValueOnce(ok(""));

    await deleteFolder(WALLET, "/", PROJECT);

    expect(commands()[0]).toBe(
      `docker exec ${CONTAINER} test -d ${BASE}/ && echo "exists" || echo "missing"`,
    );
    expect(commands()[1]).toBe(
      `docker exec -u developer ${CONTAINER} rm -rf ${BASE}/`,
    );
  });

  it("collapses '..' to the project directory itself and hands it to rm -rf", async () => {
    execAsyncMock.mockResolvedValueOnce(ok("exists"));
    execAsyncMock.mockResolvedValueOnce(ok(""));

    await deleteFolder(WALLET, "..", PROJECT);

    expect(commands()[1]).toBe(
      `docker exec -u developer ${CONTAINER} rm -rf ${BASE}/`,
    );
  });

  it("passes './' through unchanged", async () => {
    execAsyncMock.mockResolvedValueOnce(ok("exists"));
    execAsyncMock.mockResolvedValueOnce(ok(""));

    await deleteFolder(WALLET, "./", PROJECT);

    expect(commands()[1]).toBe(
      `docker exec -u developer ${CONTAINER} rm -rf ${BASE}/./`,
    );
  });

  it("requires a project name and never shell-outs without one", async () => {
    const result = await deleteFolder(WALLET, "src");

    expect(result).toEqual({
      success: false,
      error: "Project name is required",
    });
    expect(execAsyncMock).not.toHaveBeenCalled();
  });
});
