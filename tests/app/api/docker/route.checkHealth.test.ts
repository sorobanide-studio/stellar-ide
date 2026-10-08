import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/docker", () => ({
  createAndInitializeContainer: vi.fn(),
  deleteContainer: vi.fn(),
  getContainerFiles: vi.fn(),
  getFileContent: vi.fn(),
  saveFileContent: vi.fn(),
  createFile: vi.fn(),
  createFolder: vi.fn(),
  deleteFile: vi.fn(),
  deleteFolder: vi.fn(),
  createAccount: vi.fn(),
  deployContract: vi.fn(),
  buildContract: vi.fn(),
  checkContainerHealth: vi.fn(),
}));

import { POST } from "@/app/api/docker/route";
import { checkContainerHealth } from "@/lib/docker";

const ADDRESS = "G" + "A".repeat(55);

function request(body: unknown): Request {
  return new Request("http://localhost/api/docker", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/docker checkHealth", () => {
  it("returns 400 (not 500) when no walletAddress is supplied", async () => {
    const response = await POST(request({ action: "checkHealth" }));
    expect(response.status).toBe(400);
    expect(checkContainerHealth).not.toHaveBeenCalled();
  });

  it("still answers a valid checkHealth request", async () => {
    const response = await POST(
      request({ action: "checkHealth", walletAddress: ADDRESS }),
    );
    expect(response.status).toBe(200);
    expect(checkContainerHealth).toHaveBeenCalledWith(ADDRESS);
  });
});

describe("getContainerName guards the wallet address", () => {
  it("throws a descriptive error (not a TypeError) for undefined", async () => {
    const actual = await vi.importActual<typeof import("@/lib/docker")>("@/lib/docker");
    expect(() => actual.getContainerName(undefined as unknown as string)).toThrow(
      /wallet address/i,
    );
    expect(() => actual.getContainerName(undefined as unknown as string)).not.toThrow(
      TypeError,
    );
  });

  it("rejects an address that does not start with G", async () => {
    const actual = await vi.importActual<typeof import("@/lib/docker")>("@/lib/docker");
    expect(() => actual.getContainerName("ABC123")).toThrow(/wallet address/i);
  });
});
