import { describe, expect, it, vi } from "vitest";
import {
  createContainerForWallet,
  interpretContainerCreationResponse,
} from "@/lib/docker/containerState";

const ADDRESS = "G" + "A".repeat(55);

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? "OK" : "Internal Server Error",
    json: async () => body,
  } as unknown as Response;
}

describe("interpretContainerCreationResponse", () => {
  it("is ready only for an explicit success and reports the container name", () => {
    expect(
      interpretContainerCreationResponse({ success: true, containerName: "soroban-gaaaaaaaaa" }),
    ).toEqual({ ready: true, containerName: "soroban-gaaaaaaaaa" });
  });

  it("is not ready for a non-success response and keeps the error", () => {
    expect(
      interpretContainerCreationResponse({ success: false, error: "docker run failed" }),
    ).toEqual({ ready: false, error: "docker run failed" });
  });
});

describe("createContainerForWallet", () => {
  it("success path: sets ready true and reports the container name", async () => {
    const setContainerReady = vi.fn();
    const onInfo = vi.fn();

    const result = await createContainerForWallet(ADDRESS, {
      fetchFn: vi.fn(async () => jsonResponse({ success: true, containerName: "soroban-gaaaaaaaaa" })) as unknown as typeof fetch,
      setContainerReady,
      onInfo,
    });

    expect(result.ready).toBe(true);
    expect(setContainerReady).toHaveBeenCalledWith(true);
    expect(onInfo).toHaveBeenCalledWith("Container created: soroban-gaaaaaaaaa");
  });

  it("non-success response: leaves ready false and records an error", async () => {
    const setContainerReady = vi.fn();
    const onError = vi.fn();

    const result = await createContainerForWallet(ADDRESS, {
      fetchFn: vi.fn(async () => jsonResponse({ success: false, error: "boom" })) as unknown as typeof fetch,
      setContainerReady,
      onError,
    });

    expect(result.ready).toBe(false);
    expect(setContainerReady).toHaveBeenCalledWith(false);
    expect(onError).toHaveBeenCalledWith("boom");
  });

  it("non-OK HTTP status: leaves ready false and records an error", async () => {
    const setContainerReady = vi.fn();
    const onError = vi.fn();

    await createContainerForWallet(ADDRESS, {
      fetchFn: vi.fn(async () => jsonResponse({}, 500)) as unknown as typeof fetch,
      setContainerReady,
      onError,
    });

    expect(setContainerReady).toHaveBeenCalledWith(false);
    expect(onError).toHaveBeenCalledWith(expect.stringContaining("Container API error"));
  });

  it("thrown network error: leaves ready false and records an error", async () => {
    const setContainerReady = vi.fn();
    const onError = vi.fn();

    const result = await createContainerForWallet(ADDRESS, {
      fetchFn: vi.fn(async () => {
        throw new Error("network down");
      }) as unknown as typeof fetch,
      setContainerReady,
      onError,
    });

    expect(result.ready).toBe(false);
    expect(setContainerReady).toHaveBeenCalledWith(false);
    expect(onError).toHaveBeenCalledWith(expect.stringContaining("network down"));
  });
});
