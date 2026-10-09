import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/docker", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/docker")>();
  return {
    ...actual,
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
  };
});

import { POST } from "@/app/api/docker/route";
import {
  checkContainerHealth,
  getContainerName,
  isValidStellarAddress,
} from "@/lib/docker";

const ADDRESS = "G" + "A".repeat(55);

function request(body: unknown): Request {
  return new Request("http://localhost/api/docker", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/docker wallet address validation", () => {
  it("rejects a shell-injection address with 400 and runs no docker command", async () => {
    const response = await POST(
      request({ action: "checkHealth", walletAddress: "abc; rm -rf /" }),
    );
    expect(response.status).toBe(400);
    expect(checkContainerHealth).not.toHaveBeenCalled();
  });

  it("rejects a too-short address with 400", async () => {
    const response = await POST(
      request({ action: "create", walletAddress: "GABC" }),
    );
    expect(response.status).toBe(400);
  });

  it("accepts a well-formed address", async () => {
    const response = await POST(
      request({ action: "checkHealth", walletAddress: ADDRESS }),
    );
    expect(response.status).toBe(200);
    expect(checkContainerHealth).toHaveBeenCalledWith(ADDRESS);
  });
});

describe("getContainerName validation", () => {
  it("throws for an address that is not 56 characters", () => {
    expect(() => getContainerName("GABC")).toThrow(/wallet address/i);
  });

  it("throws for a 56-character non-base32 address", () => {
    expect(() => getContainerName("G" + "0".repeat(55))).toThrow(/wallet address/i);
  });

  it("throws for the injection string", () => {
    expect(() => getContainerName("abc; rm -rf /")).toThrow(/wallet address/i);
    expect(isValidStellarAddress("abc; rm -rf /")).toBe(false);
  });

  it("keeps the container name unchanged for a valid address", () => {
    expect(getContainerName(ADDRESS)).toBe(
      "soroban-" + ADDRESS.slice(0, 10).toLowerCase(),
    );
    expect(getContainerName(ADDRESS)).toBe("soroban-gaaaaaaaaa");
  });
});
