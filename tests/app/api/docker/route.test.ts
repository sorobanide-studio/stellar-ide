import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import * as docker from "@/lib/docker";
import * as projects from "@/lib/projects";
import { POST } from "@/app/api/docker/route";

vi.mock("next/server", () => ({
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) => ({
      status: init?.status ?? 200,
      body,
      json: async () => body,
    }),
  },
}));

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

vi.mock("@/lib/projects", () => ({
  getAllProjects: vi.fn(),
  createProject: vi.fn(),
  deleteProject: vi.fn(),
  getProject: vi.fn(),
  renameProject: vi.fn(),
}));

const WALLET = "GABCDEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMNOPQRSTUVWX";

interface MockResponse {
  status: number;
  json(): Promise<unknown>;
}

async function call(body: Record<string, unknown>) {
  const request = new Request("http://localhost/api/docker", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const response = (await POST(request as never)) as unknown as MockResponse;
  return { status: response.status, body: await response.json() };
}

interface DelegationCase {
  action: string;
  payload?: Record<string, unknown>;
  target: Mock;
  args: unknown[];
}

const delegationCases: DelegationCase[] = [
  {
    action: "create",
    target: docker.createAndInitializeContainer as unknown as Mock,
    args: [WALLET],
  },
  {
    action: "delete",
    target: docker.deleteContainer as unknown as Mock,
    args: [WALLET],
  },
  {
    action: "getFiles",
    payload: { projectName: "proj" },
    target: docker.getContainerFiles as unknown as Mock,
    args: [WALLET, "proj"],
  },
  {
    action: "getFileContent",
    payload: { filePath: "src/main.rs", projectName: "proj" },
    target: docker.getFileContent as unknown as Mock,
    args: [WALLET, "src/main.rs", "proj"],
  },
  {
    action: "saveFileContent",
    payload: { filePath: "src/main.rs", content: "let x = 1;", projectName: "proj" },
    target: docker.saveFileContent as unknown as Mock,
    args: [WALLET, "src/main.rs", "let x = 1;", "proj"],
  },
  {
    action: "createFile",
    payload: { filePath: "src/new.rs", projectName: "proj" },
    target: docker.createFile as unknown as Mock,
    args: [WALLET, "src/new.rs", "", "proj"],
  },
  {
    action: "createFolder",
    payload: { filePath: "src/sub", projectName: "proj" },
    target: docker.createFolder as unknown as Mock,
    args: [WALLET, "src/sub", "proj"],
  },
  {
    action: "deleteFile",
    payload: { filePath: "src/main.rs", projectName: "proj" },
    target: docker.deleteFile as unknown as Mock,
    args: [WALLET, "src/main.rs", "proj"],
  },
  {
    action: "deleteFolder",
    payload: { filePath: "src/sub", projectName: "proj" },
    target: docker.deleteFolder as unknown as Mock,
    args: [WALLET, "src/sub", "proj"],
  },
  {
    action: "createAccount",
    target: docker.createAccount as unknown as Mock,
    args: [WALLET],
  },
  {
    action: "deployContract",
    payload: { publicKey: "GPUBLIC", projectName: "proj" },
    target: docker.deployContract as unknown as Mock,
    args: [WALLET, "GPUBLIC", "proj"],
  },
  {
    action: "buildContract",
    payload: { projectName: "proj" },
    target: docker.buildContract as unknown as Mock,
    args: [WALLET, "proj"],
  },
  {
    action: "getAllProjects",
    target: projects.getAllProjects as unknown as Mock,
    args: [WALLET],
  },
  {
    action: "createProject",
    payload: { projectName: "proj", description: "desc" },
    target: projects.createProject as unknown as Mock,
    args: [WALLET, "proj", "desc"],
  },
  {
    action: "deleteProject",
    payload: { projectName: "proj" },
    target: projects.deleteProject as unknown as Mock,
    args: [WALLET, "proj"],
  },
  {
    action: "getProject",
    payload: { projectName: "proj" },
    target: projects.getProject as unknown as Mock,
    args: [WALLET, "proj"],
  },
  {
    action: "renameProject",
    payload: { oldName: "old", newName: "new" },
    target: projects.renameProject as unknown as Mock,
    args: [WALLET, "old", "new"],
  },
];

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/docker", () => {
  for (const testCase of delegationCases) {
    it(`delegates action '${testCase.action}' to its lib function`, async () => {
      testCase.target.mockResolvedValue({ handled: testCase.action });

      const response = await call({
        action: testCase.action,
        walletAddress: WALLET,
        ...(testCase.payload ?? {}),
      });

      expect(testCase.target).toHaveBeenCalledWith(...testCase.args);
      expect(response.status).toBe(200);
    });
  }

  it("wraps getAllProjects results in { success, projects }", async () => {
    (projects.getAllProjects as unknown as Mock).mockResolvedValue([{ name: "a" }]);

    const response = await call({
      action: "getAllProjects",
      walletAddress: WALLET,
    });

    expect(response.body).toEqual({ success: true, projects: [{ name: "a" }] });
  });

  it("runs checkHealth without a walletAddress", async () => {
    (docker.checkContainerHealth as unknown as Mock).mockResolvedValue(true);

    const response = await call({ action: "checkHealth" });

    expect(response.status).toBe(200);
    expect(docker.checkContainerHealth).toHaveBeenCalledWith(undefined);
    expect(response.body).toMatchObject({ isHealthy: true });
  });

  it("rejects an unknown action with a 400", async () => {
    const response = await call({ action: "notARealAction", walletAddress: WALLET });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: "Unknown action" });
  });

  it("rejects a missing walletAddress with a 400 and does not dispatch", async () => {
    const response = await call({ action: "create" });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: "Wallet address is required" });
    expect(docker.createAndInitializeContainer).not.toHaveBeenCalled();
  });

  it("never leaks the raw exception text on a 500", async () => {
    (docker.createAndInitializeContainer as unknown as Mock).mockRejectedValue(
      new Error("SECRET_TOKEN_abc123"),
    );

    const response = await call({ action: "create", walletAddress: WALLET });

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ error: "Internal server error" });
    expect(response.body).not.toHaveProperty("details");
    expect(JSON.stringify(response.body)).not.toContain("SECRET_TOKEN");
  });
});
