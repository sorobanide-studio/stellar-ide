import { describe, expect, it } from "vitest";
import {
  escapeShellArg,
  getProjectPath,
  getWorkspacePath,
} from "@/lib/docker/utils";

/**
 * Harness smoke test: proves `npm test` (vitest run) boots and that the `@/*`
 * path alias declared in tsconfig.json resolves to the repo root.
 */
describe("vitest harness", () => {
  it("resolves @/lib/* the same way tsconfig.json paths does", () => {
    expect(getWorkspacePath()).toBe("/home/developer/workspace");
    expect(getProjectPath()).toBe(
      "/home/developer/workspace/soroban-hello-world",
    );
  });

  it("imports a real module (pure helper) and exercises it", () => {
    expect(escapeShellArg("it's")).toBe("'it'\\''s'");
  });
});
