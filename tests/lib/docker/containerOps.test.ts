import { beforeEach, describe, expect, it, vi } from "vitest";

const { execAsyncMock, sleepMock } = vi.hoisted(() => ({
  execAsyncMock: vi.fn(),
  sleepMock: vi.fn(),
}));

vi.mock("../../../lib/docker/utils", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../../../lib/docker/utils")>();
  return { ...actual, execAsync: execAsyncMock, sleep: sleepMock };
});

import {
  checkContainerHealth,
  createAndInitializeContainer,
  deleteContainer,
  ensureContainerRunning,
} from "../../../lib/docker/containerOps";

const WALLET = "GBUQWP3KABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const CONTAINER = "soroban-gbuqwp3kab";
const WORKSPACE = "/home/developer/workspace";

function ok(stdout: string) {
  return { stdout, stderr: "" };
}

function commands(): string[] {
  return execAsyncMock.mock.calls.map((call) => String(call[0]));
}

beforeEach(() => {
  execAsyncMock.mockReset();
  sleepMock.mockReset();
  sleepMock.mockResolvedValue(undefined);
});

describe("createAndInitializeContainer", () => {
  it("reuses a running container whose contract already exists", async () => {
    execAsyncMock.mockResolvedValueOnce(ok(CONTAINER)); // docker ps -a
    execAsyncMock.mockResolvedValueOnce(ok("true")); // docker inspect
    execAsyncMock.mockResolvedValueOnce(ok("exists")); // test -d contract

    const result = await createAndInitializeContainer(WALLET);

    expect(result).toEqual({
      success: true,
      containerName: CONTAINER,
      message: `Container ${CONTAINER} already exists and is ready`,
    });
    expect(commands().some((c) => c.includes("stellar contract init"))).toBe(false);
    expect(sleepMock).not.toHaveBeenCalled();
  });

  it("re-initialises the contract when a running container is missing its directory", async () => {
    execAsyncMock.mockResolvedValueOnce(ok(CONTAINER)); // docker ps -a
    execAsyncMock.mockResolvedValueOnce(ok("true")); // docker inspect
    execAsyncMock.mockResolvedValueOnce(ok("missing")); // reuse verify: missing
    execAsyncMock.mockResolvedValueOnce(ok("true")); // outer verify: running
    execAsyncMock.mockResolvedValueOnce(ok("initialized")); // stellar contract init
    execAsyncMock.mockResolvedValueOnce(ok("exists")); // final verify

    const result = await createAndInitializeContainer(WALLET);

    expect(result).toEqual({
      success: true,
      containerName: CONTAINER,
      message: `Container ${CONTAINER} ready for use`,
    });
    expect(
      commands().some((c) =>
        c.includes(`stellar contract init soroban-hello-world`),
      ),
    ).toBe(true);
    // No `docker run` for an existing container.
    expect(commands().some((c) => c.includes("docker run"))).toBe(false);
  });

  it("starts a stopped container, sleeps, then initialises", async () => {
    execAsyncMock.mockResolvedValueOnce(ok(CONTAINER)); // docker ps -a
    execAsyncMock.mockResolvedValueOnce(ok("false")); // docker inspect: stopped
    execAsyncMock.mockResolvedValueOnce(ok("")); // docker start
    execAsyncMock.mockResolvedValueOnce(ok("true")); // outer verify: running
    execAsyncMock.mockResolvedValueOnce(ok("initialized")); // init
    execAsyncMock.mockResolvedValueOnce(ok("exists")); // final verify

    const result = await createAndInitializeContainer(WALLET);

    expect(commands()).toContain(`docker start ${CONTAINER}`);
    expect(sleepMock).toHaveBeenCalledTimes(1);
    expect(sleepMock).toHaveBeenCalledWith(2000);
    expect(result.success).toBe(true);
  });

  it("creates a new container when none exists", async () => {
    execAsyncMock.mockResolvedValueOnce(ok("")); // docker ps -a: none
    execAsyncMock.mockResolvedValueOnce(ok("container-id")); // docker run
    execAsyncMock.mockResolvedValueOnce(ok("true")); // outer verify
    execAsyncMock.mockResolvedValueOnce(ok("initialized")); // init
    execAsyncMock.mockResolvedValueOnce(ok("exists")); // final verify

    const result = await createAndInitializeContainer(WALLET);

    expect(
      commands().some((c) =>
        c.includes(
          `docker run -d --name ${CONTAINER} -e STELLAR_HOME=/home/developer/workspace/.stellar stellar-sandbox:v1 tail -f /dev/null`,
        ),
      ),
    ).toBe(true);
    expect(result.message).toBe(`Container ${CONTAINER} ready for use`);
  });

  it("surfaces a docker run failure as { success: false }", async () => {
    execAsyncMock.mockResolvedValueOnce(ok("")); // docker ps -a: none
    execAsyncMock.mockRejectedValueOnce(new Error("no such image")); // docker run

    const result = await createAndInitializeContainer(WALLET);

    expect(result).toEqual({ success: false, error: "no such image" });
  });
});

describe("deleteContainer", () => {
  it("returns success even when stop and remove both reject", async () => {
    execAsyncMock.mockRejectedValueOnce(new Error("not running"));
    execAsyncMock.mockRejectedValueOnce(new Error("no such container"));

    const result = await deleteContainer(WALLET);

    expect(result).toEqual({
      success: true,
      containerName: CONTAINER,
      message: `Container ${CONTAINER} deleted`,
    });
    expect(commands()).toEqual([
      `docker stop ${CONTAINER}`,
      `docker rm -f ${CONTAINER}`,
    ]);
  });
});

describe("checkContainerHealth", () => {
  it("returns false rather than throwing when docker inspect rejects", async () => {
    execAsyncMock.mockRejectedValueOnce(new Error("engine down"));

    await expect(checkContainerHealth(WALLET)).resolves.toBe(false);
  });

  it("returns true when the container reports running", async () => {
    execAsyncMock.mockResolvedValueOnce(ok("true"));

    await expect(checkContainerHealth(WALLET)).resolves.toBe(true);
  });
});

describe("ensureContainerRunning", () => {
  it("throws with the wallet address in the message when not running", async () => {
    execAsyncMock.mockRejectedValueOnce(new Error("engine down"));

    await expect(ensureContainerRunning(WALLET)).rejects.toThrow(WALLET);
  });

  it("resolves when the container is running", async () => {
    execAsyncMock.mockResolvedValueOnce(ok("true"));

    await expect(ensureContainerRunning(WALLET)).resolves.toBeUndefined();
  });
});
