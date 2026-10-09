// @vitest-environment node
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { POST } from "../../app/api/docker/route";

const WALLET_ADDRESS = "GBUQWP3K3AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
const CONTAINER_NAME = "soroban-gbuqwp3k3e";
const PROJECT_NAME = "soroban-hello-world";
// 16 bytes: not a multiple of 3, so the base64 text is longer than the binary.
const WASM_BYTES = "hello-wasm-bytes";

const dockerStub = `#!/usr/bin/env bash
# Deterministic fake "docker" CLI. It records each invocation's argv and prints
# canned output; it never contacts a Docker socket or a real daemon.
set -u
echo "$*" >> "$DOCKER_STUB_LOG"
cmd="$*"
if [ "$1" = "inspect" ]; then
  echo "true"
elif [ "$1" = "ps" ]; then
  echo ""
elif [ "$1" = "run" ]; then
  echo "0123456789abcdef"
elif [ "$1" = "stop" ] || [ "$1" = "rm" ] || [ "$1" = "start" ]; then
  echo ""
elif [ "$1" = "exec" ]; then
  case "$cmd" in
    *"-maxdepth 1"*) : ;;
    *"-type f"*) echo "src/lib.rs"; echo "Cargo.toml"; echo "Cargo.lock" ;;
    *"ls -la"*) echo "total 8" ;;
    *" cat "*) printf '%s' "hello-wasm-bytes" ;;
    *"test -d"*) : ;;
    *"test -f"*) : ;;
    *) : ;;
  esac
else
  echo ""
fi
exit 0
`;

let stubRoot: string;
let argvLog: string;
let originalPath: string | undefined;

const readArgvLog = () => readFileSync(argvLog, "utf8");

async function callRoute(body: Record<string, unknown>) {
  const response = await POST(
    new Request("http://localhost/api/docker", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    })
  );
  return {
    status: response.status,
    body: (await response.json()) as Record<string, unknown>,
  };
}

beforeAll(() => {
  stubRoot = mkdtempSync(join(tmpdir(), "stellar-ide-docker-stub-"));
  argvLog = join(stubRoot, "argv.log");
  writeFileSync(argvLog, "");
  const stubPath = join(stubRoot, "docker");
  writeFileSync(stubPath, dockerStub);
  chmodSync(stubPath, 0o755);
  process.env.DOCKER_STUB_LOG = argvLog;
  originalPath = process.env.PATH;
  process.env.PATH = `${stubRoot}:${originalPath ?? ""}`;
});

beforeEach(() => {
  writeFileSync(argvLog, "");
});

afterAll(() => {
  if (originalPath === undefined) {
    delete process.env.PATH;
  } else {
    process.env.PATH = originalPath;
  }
  delete process.env.DOCKER_STUB_LOG;
  rmSync(stubRoot, { recursive: true, force: true });
});

describe("POST /api/docker driven by a fake docker binary", () => {
  it("serves getFiles from the stub without touching a Docker socket", async () => {
    const { status, body } = await callRoute({
      action: "getFiles",
      walletAddress: WALLET_ADDRESS,
      projectName: PROJECT_NAME,
    });

    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.files).toEqual(["src/lib.rs", "Cargo.toml"]);

    const argv = readArgvLog();
    expect(argv).toContain("inspect");
    expect(argv).toContain(CONTAINER_NAME);
    expect(argv).not.toContain(WALLET_ADDRESS);
    expect(argv).not.toContain("docker.sock");
  });

  it("saves a file through the base64 pipe using only escaped arguments", async () => {
    const content = "pub fn hi() {}";
    const { status, body } = await callRoute({
      action: "saveFileContent",
      walletAddress: WALLET_ADDRESS,
      filePath: "src/lib.rs",
      content,
      projectName: PROJECT_NAME,
    });

    expect(status).toBe(200);
    expect(body.success).toBe(true);

    const argv = readArgvLog();
    expect(argv).toContain("base64 -d");
    expect(argv).toContain(Buffer.from(content).toString("base64"));
    expect(argv).not.toContain(WALLET_ADDRESS);
  });

  it("neutralises path traversal before it reaches the command line", async () => {
    await callRoute({
      action: "saveFileContent",
      walletAddress: WALLET_ADDRESS,
      filePath: "../../etc/passwd",
      content: "nope",
      projectName: PROJECT_NAME,
    });

    const argv = readArgvLog();
    expect(argv).not.toContain("..");
    expect(argv).not.toContain(WALLET_ADDRESS);
  });

  it("builds a contract and reports the decoded WASM byte length", async () => {
    const { status, body } = await callRoute({
      action: "buildContract",
      walletAddress: WALLET_ADDRESS,
      projectName: PROJECT_NAME,
    });

    expect(status).toBe(200);
    expect(body.success).toBe(true);

    const wasmBase64 = body.wasmBase64 as string;
    expect(Buffer.from(wasmBase64, "base64").toString("utf8")).toBe(WASM_BYTES);
    expect(body.wasmSize).toBe(Buffer.from(wasmBase64, "base64").length);
    expect(body.wasmSize).toBe(Buffer.byteLength(WASM_BYTES));
    // The encoded text is ~33% longer than the binary it carries, so a size
    // read off the base64 string would be wrong.
    expect(wasmBase64.length).toBeGreaterThan(body.wasmSize as number);
  });

  it("creates and deletes a project through the route", async () => {
    const created = await callRoute({
      action: "createProject",
      walletAddress: WALLET_ADDRESS,
      projectName: "demo-contract",
      description: "demo",
    });
    expect(created.status).toBe(200);
    expect(created.body.success).toBe(true);
    expect((created.body.project as { name: string }).name).toBe("demo-contract");

    const deleted = await callRoute({
      action: "deleteProject",
      walletAddress: WALLET_ADDRESS,
      projectName: "demo-contract",
    });
    expect(deleted.status).toBe(200);
    expect(deleted.body.success).toBe(true);
  });
});
