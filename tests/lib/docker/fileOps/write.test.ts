import { beforeEach, describe, expect, it, vi } from "vitest";

const { execAsyncMock } = vi.hoisted(() => ({ execAsyncMock: vi.fn() }));

vi.mock("../../../../lib/docker/utils", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../../../../lib/docker/utils")>();
  return { ...actual, execAsync: execAsyncMock };
});

import {
  createFile,
  saveFileContent,
} from "../../../../lib/docker/fileOps/write";
import { escapeShellArg } from "../../../../lib/docker/utils";

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

/** Pull the base64 payload out of `echo '<payload>' | base64 -d`. */
function payloadOf(command: string): string {
  const match = command.match(/echo '([^']*)' \| base64 -d/);
  return match ? match[1] : "";
}

beforeEach(() => {
  execAsyncMock.mockReset();
});

describe("saveFileContent", () => {
  it("round-trips multi-line content through base64 and uses only base64-safe characters", async () => {
    const content = "fn main() {\n    let x = 1;\n}\n";
    const expectedBase64 = Buffer.from(content).toString("base64");

    execAsyncMock.mockResolvedValueOnce(ok("exists"));
    execAsyncMock.mockResolvedValueOnce(ok(""));

    const result = await saveFileContent(WALLET, "src/lib.rs", content, PROJECT);

    expect(result).toEqual({ success: true, message: "File saved" });
    expect(commands()).toEqual([
      `docker exec ${CONTAINER} test -f ${BASE}/src/lib.rs && echo "exists" || echo "missing"`,
      `docker exec -u developer ${CONTAINER} sh -c "echo ${escapeShellArg(
        expectedBase64,
      )} | base64 -d > ${BASE}/src/lib.rs"`,
    ]);

    const payload = payloadOf(commands()[1]);
    expect(payload).toBe(expectedBase64);
    expect(payload).toMatch(/^[A-Za-z0-9+/=]+$/);
    expect(commands()[1]).not.toContain("\n");
    expect(commands()[1]).toContain(`echo '${expectedBase64}'`);
  });

  it("refuses to create a file that does not exist yet", async () => {
    execAsyncMock.mockResolvedValueOnce(ok("missing"));
    execAsyncMock.mockResolvedValueOnce(ok(""));

    const result = await saveFileContent(WALLET, "src/lib.rs", "data", PROJECT);

    expect(result).toEqual({
      success: false,
      error: `File not found at ${BASE}/src/lib.rs. Try refreshing the file tree.`,
    });
    expect(commands()[1]).toBe(
      `docker exec ${CONTAINER} find ${BASE} -name "lib.rs" 2>/dev/null || true`,
    );
  });

  it("requires a project name and never shell-outs without one", async () => {
    const result = await saveFileContent(WALLET, "src/lib.rs", "data");

    expect(result).toEqual({
      success: false,
      error: "Project name is required",
    });
    expect(execAsyncMock).not.toHaveBeenCalled();
  });
});

describe("createFile", () => {
  it("creates parent directories derived from lastIndexOf('/') then writes base64", async () => {
    const content = "pub fn helper() {}";
    const expectedBase64 = Buffer.from(content).toString("base64");

    execAsyncMock.mockResolvedValueOnce(ok(""));
    execAsyncMock.mockResolvedValueOnce(ok(""));

    const result = await createFile(
      WALLET,
      "src/new/util/helper.rs",
      content,
      PROJECT,
    );

    expect(result).toEqual({
      success: true,
      message: "File src/new/util/helper.rs created",
    });
    expect(commands()[0]).toBe(
      `docker exec -u developer ${CONTAINER} mkdir -p ${BASE}/src/new/util`,
    );
    expect(commands()[1]).toBe(
      `docker exec -u developer ${CONTAINER} sh -c "echo ${escapeShellArg(
        expectedBase64,
      )} | base64 -d > ${BASE}/src/new/util/helper.rs"`,
    );
  });

  it("uses touch (never base64 -d) when content is empty", async () => {
    execAsyncMock.mockResolvedValueOnce(ok(""));
    execAsyncMock.mockResolvedValueOnce(ok(""));

    const result = await createFile(WALLET, "notes.txt", "", PROJECT);

    expect(result).toEqual({
      success: true,
      message: "File notes.txt created",
    });
    expect(commands()[0]).toBe(
      `docker exec -u developer ${CONTAINER} mkdir -p ${BASE}`,
    );
    expect(commands()[1]).toBe(
      `docker exec -u developer ${CONTAINER} touch ${BASE}/notes.txt`,
    );
    expect(commands().join("\n")).not.toContain("base64 -d");
  });

  it("writes content when content is provided", async () => {
    execAsyncMock.mockResolvedValueOnce(ok(""));
    execAsyncMock.mockResolvedValueOnce(ok(""));

    await createFile(WALLET, "main.rs", "fn main() {}", PROJECT);

    expect(commands()[1]).toContain("base64 -d");
  });

  it("requires a project name and never shell-outs without one", async () => {
    const result = await createFile(WALLET, "main.rs", "fn main() {}");

    expect(result).toEqual({
      success: false,
      error: "Project name is required",
    });
    expect(execAsyncMock).not.toHaveBeenCalled();
  });
});
