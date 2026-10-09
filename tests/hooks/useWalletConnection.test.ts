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
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type Mock,
} from "vitest";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { setAllowed, getAddress } from "@stellar/freighter-api";
import { useWallet } from "@/context/WalletContext";
import { useWalletConnection } from "@/hooks/useWalletConnection";

vi.mock("@stellar/freighter-api", () => ({
  setAllowed: vi.fn(),
  getAddress: vi.fn(),
}));

vi.mock("@/context/WalletContext", () => ({
  useWallet: vi.fn(),
}));

// React 19 requires this flag so `act(...)` does not warn about the test env.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

const WALLET = "GABCDEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMNOPQRSTUVWX";

interface WalletContextStub {
  connect: Mock;
  disconnect: Mock;
  setContainerReady: Mock;
}

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? "OK" : "Error",
    json: async () => body,
  } as unknown as Response;
}

function renderWalletConnection() {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  const result: { current: ReturnType<typeof useWalletConnection> } = {
    current: undefined as unknown as ReturnType<typeof useWalletConnection>,
  };

  function Probe() {
    result.current = useWalletConnection();
    return null;
  }

  act(() => {
    root.render(createElement(Probe));
  });

  return {
    result,
    unmount: () => {
      act(() => root.unmount());
      container.remove();
    },
  };
}

let walletContext: WalletContextStub;
let fetchMock: Mock;

beforeEach(() => {
  walletContext = {
    connect: vi.fn(),
    disconnect: vi.fn(),
    setContainerReady: vi.fn(),
  };
  (useWallet as unknown as Mock).mockReturnValue(walletContext);
  (setAllowed as unknown as Mock).mockReset();
  (getAddress as unknown as Mock).mockReset();
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("useWalletConnection", () => {
  it("records the native balance from Horizon and marks the container ready", async () => {
    (setAllowed as Mock).mockResolvedValue({ isAllowed: true });
    (getAddress as Mock).mockResolvedValue({ address: WALLET });
    fetchMock.mockImplementation(async (input: unknown) => {
      const url = String(input);
      if (url.includes("horizon-testnet.stellar.org")) {
        return jsonResponse(200, {
          balances: [{ asset_type: "native", balance: "100.0000000" }],
        });
      }
      return jsonResponse(200, {
        success: true,
        containerName: "soroban-gabcdefghi",
      });
    });

    const { result } = renderWalletConnection();
    await act(async () => {
      await result.current.handleConnect();
    });

    expect(walletContext.connect).toHaveBeenCalledWith(WALLET, "100.0000000");
    expect(walletContext.setContainerReady).toHaveBeenCalledWith(true);
    expect(result.current.error).toBeNull();
  });

  it("reports an unfunded account (404) as a zero balance without an error", async () => {
    (setAllowed as Mock).mockResolvedValue({ isAllowed: true });
    (getAddress as Mock).mockResolvedValue({ address: WALLET });
    fetchMock.mockImplementation(async (input: unknown) => {
      const url = String(input);
      if (url.includes("horizon-testnet.stellar.org")) {
        return jsonResponse(404, { detail: "not found" });
      }
      return jsonResponse(200, { success: true, containerName: "c" });
    });

    const { result } = renderWalletConnection();
    await act(async () => {
      await result.current.handleConnect();
    });

    expect(walletContext.connect).toHaveBeenCalledWith(WALLET, "0.00");
    expect(result.current.error).toBeNull();
  });

  it("surfaces a 429 from Horizon instead of reporting a zero balance", async () => {
    (setAllowed as Mock).mockResolvedValue({ isAllowed: true });
    (getAddress as Mock).mockResolvedValue({ address: WALLET });
    fetchMock.mockImplementation(async (input: unknown) => {
      const url = String(input);
      if (url.includes("horizon-testnet.stellar.org")) {
        return jsonResponse(429, { detail: "rate limited" });
      }
      return jsonResponse(200, { success: true });
    });

    const { result } = renderWalletConnection();
    await act(async () => {
      await result.current.handleConnect();
    });

    expect(result.current.error).toContain("429");
    expect(walletContext.connect).not.toHaveBeenCalled();
  });

  it("surfaces a transport failure instead of reporting a zero balance", async () => {
    (setAllowed as Mock).mockResolvedValue({ isAllowed: true });
    (getAddress as Mock).mockResolvedValue({ address: WALLET });
    fetchMock.mockRejectedValue(new Error("network down"));

    const { result } = renderWalletConnection();
    await act(async () => {
      await result.current.handleConnect();
    });

    expect(result.current.error).toBeTruthy();
    expect(walletContext.connect).not.toHaveBeenCalled();
  });

  it("sets the approve-access error and never calls getAddress when access is denied", async () => {
    (setAllowed as Mock).mockResolvedValue({ isAllowed: false });

    const { result } = renderWalletConnection();
    await act(async () => {
      await result.current.handleConnect();
    });

    expect(result.current.error).toBe(
      "Please approve wallet access in the Freighter popup.",
    );
    expect(getAddress).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(walletContext.setContainerReady).not.toHaveBeenCalled();
  });

  it("does not mark the wallet ready when the container API responds with a non-ok status", async () => {
    (setAllowed as Mock).mockResolvedValue({ isAllowed: true });
    (getAddress as Mock).mockResolvedValue({ address: WALLET });
    fetchMock.mockImplementation(async (input: unknown) => {
      const url = String(input);
      if (url.includes("horizon-testnet.stellar.org")) {
        return jsonResponse(200, {
          balances: [{ asset_type: "native", balance: "1.0" }],
        });
      }
      return jsonResponse(500, { error: "boom" });
    });

    const { result } = renderWalletConnection();
    await act(async () => {
      await result.current.handleConnect();
    });

    expect(walletContext.setContainerReady).not.toHaveBeenCalled();
    expect(result.current.error).toContain("Container API error");
    // The wallet itself still connected; only the container is not ready.
    expect(walletContext.connect).toHaveBeenCalledWith(WALLET, "1.0");
  });

  it("does not mark the wallet ready when the container response reports failure", async () => {
    (setAllowed as Mock).mockResolvedValue({ isAllowed: true });
    (getAddress as Mock).mockResolvedValue({ address: WALLET });
    fetchMock.mockImplementation(async (input: unknown) => {
      const url = String(input);
      if (url.includes("horizon-testnet.stellar.org")) {
        return jsonResponse(200, {
          balances: [{ asset_type: "native", balance: "1.0" }],
        });
      }
      return jsonResponse(200, { success: false, error: "docker unavailable" });
    });

    const { result } = renderWalletConnection();
    await act(async () => {
      await result.current.handleConnect();
    });

    expect(walletContext.setContainerReady).not.toHaveBeenCalled();
    expect(result.current.error).toContain("Container creation failed");
  });

  it("handleDisconnect clears the error and delegates to the context", async () => {
    const { result } = renderWalletConnection();

    await act(async () => {
      result.current.setError("oops");
    });
    expect(result.current.error).toBe("oops");

    act(() => {
      result.current.handleDisconnect();
    });

    expect(result.current.error).toBeNull();
    expect(walletContext.disconnect).toHaveBeenCalledTimes(1);
  });
});
