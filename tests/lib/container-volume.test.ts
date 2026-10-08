import { describe, expect, it } from "vitest";
import { buildRunContainerCommand } from "../../lib/docker/containerOps";
import { getContainerName, getWorkspaceVolumeName } from "../../lib/docker/utils";

describe("workspace persistence volume", () => {
  const wallet =
    "GBUQWP3KD3N6EMVMB3Z6P2PRHRG7H6NKF3QVJ7M3Q5H2DPYH7GZ7DEMO";

  it("docker run mounts a per-wallet named volume at the workspace path", () => {
    const cmd = buildRunContainerCommand(wallet);
    expect(cmd).toContain(
      `-v ${getWorkspaceVolumeName(wallet)}:/home/developer/workspace`,
    );
    expect(cmd).toContain("-d");
    expect(cmd).toContain(getContainerName(wallet));
  });

  it("names the volume per wallet so two wallets never share a workspace", () => {
    expect(getWorkspaceVolumeName(wallet)).toContain(getContainerName(wallet));
    expect(getWorkspaceVolumeName("GAAAA")).not.toBe(
      getWorkspaceVolumeName("GBBB"),
    );
  });
});
