import { beforeEach, describe, expect, it, vi } from "vitest";

const { execAsyncMock } = vi.hoisted(() => ({ execAsyncMock: vi.fn() }));

vi.mock("../../../lib/docker/utils", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../../../lib/docker/utils")>();
  return { ...actual, execAsync: execAsyncMock };
});

import {
  buildAndDeploy,
  deployContract,
  getDeploymentStatus,
} from "../../../lib/docker/deployOps";

const WALLET = "GBUQWP3KABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const CONTAINER = "soroban-gbuqwp3kab";
const WORKSPACE = "/home/developer/workspace";
const PROJECT = "my-proj";
const PUBLIC_KEY = "GPUBKEYFROMCALLER234567";

function ok(stdout: string) {
  return { stdout, stderr: "" };
}

function commands(): string[] {
  return execAsyncMock.mock.calls.map((call) => String(call[0]));
}

beforeEach(() => {
  execAsyncMock.mockReset();
});

describe("deployContract", () => {
  it("uses the caller's publicKey as --source-account when supplied", async () => {
    execAsyncMock.mockResolvedValueOnce(ok("deployed"));

    await deployContract(WALLET, PUBLIC_KEY, PROJECT);

    const command = commands()[0];
    expect(command).toContain(`--source-account ${PUBLIC_KEY}`);
    expect(command).not.toContain("--source-account darshan");
  });

  it("falls back to the local darshan identity when publicKey is omitted", async () => {
    execAsyncMock.mockResolvedValueOnce(ok("deployed"));

    await deployContract(WALLET, undefined, PROJECT);

    const command = commands()[0];
    expect(command).toContain("--source-account darshan");
    expect(command).not.toContain(PUBLIC_KEY);
  });

  it("produces different commands for the two ternary branches", async () => {
    execAsyncMock.mockResolvedValueOnce(ok("deployed"));
    await deployContract(WALLET, PUBLIC_KEY, PROJECT);
    const withKey = commands()[0];

    execAsyncMock.mockReset();
    execAsyncMock.mockResolvedValueOnce(ok("deployed"));
    await deployContract(WALLET, undefined, PROJECT);
    const withoutKey = commands()[0];

    expect(withKey).not.toBe(withoutKey);
  });

  it("chains build and deploy behind set -e for buildAndDeploy", async () => {
    execAsyncMock.mockResolvedValueOnce(ok("done"));

    await buildAndDeploy(WALLET, PUBLIC_KEY, PROJECT);

    const command = commands()[0];
    expect(command).toContain("set -e");
    expect(command).toContain("stellar contract build");
    expect(command).toContain("cargo build --target wasm32v1-none --release");
    expect(command).toContain("stellar contract deploy");
    expect(command).toContain(`--source-account ${PUBLIC_KEY}`);
    expect(command).toBe(
      `docker exec -u developer -w ${WORKSPACE}/${PROJECT} ${CONTAINER} sh -c "set -e; echo 'Starting build...'; stellar contract build; echo 'Building WASM...'; cargo build --target wasm32v1-none --release; echo 'Deploying...'; stellar contract deploy --wasm target/wasm32v1-none/release/hello_world.wasm --source-account ${PUBLIC_KEY} --network testnet --alias hello_world"`,
    );
  });
});

describe("getDeploymentStatus", () => {
  it("reports isDeployed: false when grep returns nothing", async () => {
    execAsyncMock.mockResolvedValueOnce(ok(""));

    const result = await getDeploymentStatus(WALLET, PROJECT);

    expect(result).toEqual({
      success: true,
      isDeployed: false,
      message: "Contract has not been deployed yet",
    });
  });

  it("reports isDeployed: true when grep finds the alias", async () => {
    execAsyncMock.mockResolvedValueOnce(ok("hello_world"));

    const result = await getDeploymentStatus(WALLET, PROJECT);

    expect(result.isDeployed).toBe(true);
  });
});
