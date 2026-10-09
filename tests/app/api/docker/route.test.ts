import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/docker", () => ({
  createAndInitializeContainer: vi.fn(),
  deleteContainer: vi.fn(),
  getContainerFiles: vi.fn(),
  getFileContent: vi.fn(),
  saveFileContent: vi.fn(async () => ({ success: true })),
  createFile: vi.fn(async () => ({ success: true })),
  createFolder: vi.fn(),
  deleteFile: vi.fn(),
  deleteFolder: vi.fn(),
  createAccount: vi.fn(),
  deployContract: vi.fn(),
  buildContract: vi.fn(),
  checkContainerHealth: vi.fn(),
}));

import { POST } from "@/app/api/docker/route";
import { createFile } from "@/lib/docker";

const ADDRESS = "G" + "A".repeat(55);

function request(body: unknown): Request {
  return new Request("http://localhost/api/docker", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/docker createFile", () => {
  it("forwards the request content unchanged", async () => {
    const response = await POST(
      request({
        action: "createFile",
        walletAddress: ADDRESS,
        filePath: "src/lib.rs",
        projectName: "proj",
        content: "fn main() {}",
      }),
    );

    expect(response.status).toBe(200);
    expect(createFile).toHaveBeenCalledWith(ADDRESS, "src/lib.rs", "fn main() {}", "proj");
    expect(vi.mocked(createFile).mock.calls[0][2]).toBe("fn main() {}");
  });

  it("defaults to an empty string when content is omitted", async () => {
    await POST(
      request({
        action: "createFile",
        walletAddress: ADDRESS,
        filePath: "empty.rs",
        projectName: "proj",
      }),
    );

    expect(createFile).toHaveBeenCalledWith(ADDRESS, "empty.rs", "", "proj");
  });
});
