import { describe, expect, it } from "vitest";
import {
  getCredentialBackupPath,
  getProjectPath,
  getWorkspacePath,
} from "../../lib/docker/utils";

describe("credential backup path", () => {
  const wallet =
    "GBUQWP3KD3N6EMVMB3Z6P2PRHRG7H6NKF3QVJ7M3Q5H2DPYH7GZ7DEMO";

  it("is outside the workspace, so a project delete cannot remove it", () => {
    const backup = getCredentialBackupPath(wallet);
    expect(backup.startsWith(getWorkspacePath())).toBe(false);
    expect(backup.startsWith(getProjectPath())).toBe(false);
  });

  it("is named after the wallet, not the project", () => {
    expect(getCredentialBackupPath("GAAAA")).not.toBe(
      getCredentialBackupPath("GBBB"),
    );
    expect(getCredentialBackupPath(wallet)).toContain("soroban-gbuqwp3k");
  });
});
