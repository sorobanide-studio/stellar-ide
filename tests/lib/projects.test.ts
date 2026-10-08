import { beforeEach, describe, expect, it, vi } from "vitest";

const { execAsyncMock } = vi.hoisted(() => ({ execAsyncMock: vi.fn() }));

vi.mock("../../lib/docker/utils", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../../lib/docker/utils")>();
  return { ...actual, execAsync: execAsyncMock };
});

import {
  createProject,
  deleteProject,
  getAllProjects,
  getProject,
  renameProject,
} from "../../lib/projects";

const WALLET = "GBUQWP3KABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const CONTAINER = "soroban-gbuqwp3kab";
const WORKSPACE = "/home/developer/workspace";

/** What the `find` listing returns; tests mutate this to shape the workspace. */
let findOutput = "";

function commands(): string[] {
  return execAsyncMock.mock.calls.map((call) => String(call[0]));
}

beforeEach(() => {
  findOutput = "";
  execAsyncMock.mockReset();
  execAsyncMock.mockImplementation(async (command: string) => {
    const cmd = String(command);
    if (cmd.includes("stellar contract init")) return { stdout: "ok", stderr: "" };
    if (cmd.includes(" mv ")) return { stdout: "", stderr: "" };
    if (cmd.includes("rm -rf")) return { stdout: "", stderr: "" };
    if (cmd.includes(" find ")) return { stdout: findOutput, stderr: "" };
    return { stdout: "", stderr: "" };
  });
});

describe("getAllProjects", () => {
  it("maps workspace folders to Project rows and drops dotfolders", async () => {
    findOutput = "alpha\n.hidden\nbeta\n";

    const projects = await getAllProjects(WALLET);

    expect(projects.map((p) => p.name)).toEqual(["alpha", "beta"]);
    expect(projects[0]).toMatchObject({
      id: "project_alpha",
      name: "alpha",
      description: "Soroban contract project",
      contractType: "soroban",
    });
    expect(projects[0].createdAt).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/,
    );
    expect(commands()[0]).toBe(
      `docker exec ${CONTAINER} find ${WORKSPACE} -maxdepth 1 -type d ! -name workspace -exec basename {} \\;`,
    );
  });

  it("returns [] when docker exec rejects", async () => {
    execAsyncMock.mockRejectedValueOnce(new Error("docker down"));

    await expect(getAllProjects(WALLET)).resolves.toEqual([]);
  });
});

describe("createProject", () => {
  it("interpolates the project name unquoted into stellar contract init", async () => {
    findOutput = "";

    const result = await createProject(WALLET, "my project", "Custom blurb");

    expect(result.success).toBe(true);
    expect(result.project?.description).toBe("Custom blurb");
    const initCommand = commands().find((c) =>
      c.includes("stellar contract init"),
    );
    // The space in the name is passed through raw — this is the current
    // (broken) shell contract, pinned deliberately.
    expect(initCommand).toBe(
      `docker exec -u developer ${CONTAINER} sh -c "cd ${WORKSPACE} && stellar contract init my project"`,
    );
  });

  it("does not persist a custom description into the later listing", async () => {
    findOutput = "";
    const created = await createProject(WALLET, "alpha", "Custom blurb");
    expect(created.project?.description).toBe("Custom blurb");

    findOutput = "alpha";
    const listed = await getAllProjects(WALLET);

    expect(listed[0].description).toBe("Soroban contract project");
    expect(listed[0].description).not.toBe("Custom blurb");
  });

  it("returns { success: false } for a duplicate before running anything", async () => {
    findOutput = "alpha";

    const result = await createProject(WALLET, "alpha");

    expect(result).toEqual({ success: false, error: "Project already exists" });
    expect(commands().some((c) => c.includes("stellar contract init"))).toBe(
      false,
    );
    // Only the listing `find` ran.
    expect(execAsyncMock).toHaveBeenCalledTimes(1);
  });
});

describe("deleteProject", () => {
  it("removes the quoted project directory", async () => {
    const result = await deleteProject(WALLET, "alpha");

    expect(result).toEqual({ success: true });
    expect(commands()[0]).toBe(
      `docker exec -u developer ${CONTAINER} rm -rf "${WORKSPACE}/alpha"`,
    );
  });
});

describe("getProject", () => {
  it("returns { success: false, error: 'Project not found' } for an unknown name", async () => {
    findOutput = "alpha";

    const result = await getProject(WALLET, "missing");

    expect(result).toEqual({ success: false, error: "Project not found" });
  });

  it("returns the project for a known name", async () => {
    findOutput = "alpha";

    const result = await getProject(WALLET, "alpha");

    expect(result.success).toBe(true);
    expect(result.project?.name).toBe("alpha");
  });
});

describe("renameProject", () => {
  it("guards a missing source and never moves", async () => {
    findOutput = "alpha";

    const result = await renameProject(WALLET, "missing", "beta");

    expect(result).toEqual({ success: false, error: "Project not found" });
    expect(commands().some((c) => c.includes(" mv "))).toBe(false);
  });

  it("guards an existing target and never moves", async () => {
    findOutput = "alpha\nbeta";

    const result = await renameProject(WALLET, "alpha", "beta");

    expect(result).toEqual({ success: false, error: "New name already exists" });
    expect(commands().some((c) => c.includes(" mv "))).toBe(false);
  });

  it("moves the quoted folder and returns the renamed project", async () => {
    findOutput = "alpha";

    const result = await renameProject(WALLET, "alpha", "gamma");

    expect(result.success).toBe(true);
    expect(result.project?.name).toBe("gamma");
    expect(commands()[1]).toBe(
      `docker exec -u developer ${CONTAINER} mv "${WORKSPACE}/alpha" "${WORKSPACE}/gamma"`,
    );
  });
});
