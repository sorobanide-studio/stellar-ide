import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { WalletProvider, useWallet } from "@/context/WalletContext";

// React 19 requires this flag so `act(...)` does not warn about the test env.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

const ADDRESS = "GABCDEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMNOPQRSTUVWX";

type WalletValue = ReturnType<typeof useWallet>;

function renderProvider() {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  const value: { current: WalletValue } = {
    current: undefined as unknown as WalletValue,
  };

  function Probe() {
    value.current = useWallet();
    return null;
  }

  act(() => {
    root.render(
      createElement(WalletProvider, null, createElement(Probe)),
    );
  });

  return {
    value,
    unmount: () => {
      act(() => root.unmount());
      container.remove();
    },
  };
}

let fetchSpy: ReturnType<typeof vi.fn>;

beforeEach(() => {
  window.localStorage.clear();
  fetchSpy = vi.fn();
  vi.stubGlobal("fetch", fetchSpy);
});

afterEach(() => {
  vi.unstubAllGlobals();
  window.localStorage.clear();
});

describe("WalletProvider state transitions", () => {
  it("starts disconnected when nothing is persisted", () => {
    const { value } = renderProvider();

    expect(value.current.walletAddress).toBeNull();
    expect(value.current.walletBalance).toBe("0.00");
    expect(value.current.isConnected).toBe(false);
    expect(value.current.isContainerReady).toBe(false);
    expect(value.current.containerName).toBeNull();
  });

  it("connect(address, balance) sets the wallet, container name and persistence", () => {
    const { value } = renderProvider();

    act(() => {
      value.current.connect(ADDRESS, "42.5");
    });

    expect(value.current.walletAddress).toBe(ADDRESS);
    expect(value.current.walletBalance).toBe("42.5");
    expect(value.current.isConnected).toBe(true);
    expect(value.current.containerName).toBe("soroban-gabcdefghi");
    expect(window.localStorage.getItem("wallet_address")).toBe(ADDRESS);
    expect(window.localStorage.getItem("wallet_balance")).toBe("42.5");
  });

  it("disconnect() clears the address, balance and containerReady", () => {
    const { value } = renderProvider();

    act(() => {
      value.current.connect(ADDRESS, "10.00");
    });
    act(() => {
      value.current.setContainerReady(true);
    });
    expect(value.current.isContainerReady).toBe(true);

    act(() => {
      value.current.disconnect();
    });

    expect(value.current.walletAddress).toBeNull();
    expect(value.current.walletBalance).toBe("0.00");
    expect(value.current.isConnected).toBe(false);
    expect(value.current.isContainerReady).toBe(false);
    expect(value.current.containerName).toBeNull();
    expect(window.localStorage.getItem("wallet_address")).toBeNull();
    expect(window.localStorage.getItem("wallet_balance")).toBeNull();
  });

  it("setContainerReady toggles the container flag", () => {
    const { value } = renderProvider();

    act(() => {
      value.current.setContainerReady(true);
    });
    expect(value.current.isContainerReady).toBe(true);

    act(() => {
      value.current.setContainerReady(false);
    });
    expect(value.current.isContainerReady).toBe(false);
  });

  it("restores persisted state on a fresh mount", () => {
    window.localStorage.setItem("wallet_address", ADDRESS);
    window.localStorage.setItem("wallet_balance", "7.77");

    const { value } = renderProvider();

    expect(value.current.walletAddress).toBe(ADDRESS);
    expect(value.current.walletBalance).toBe("7.77");
    expect(value.current.isConnected).toBe(true);
  });

  it("performs no network calls during the transitions", () => {
    const { value } = renderProvider();

    act(() => {
      value.current.connect(ADDRESS, "1.00");
    });
    act(() => {
      value.current.setContainerReady(true);
    });
    act(() => {
      value.current.disconnect();
    });

    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
