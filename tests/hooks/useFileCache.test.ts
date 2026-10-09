import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { useFileCache } from "@/hooks/useFileCache";

// React 19 requires this flag so `act(...)` does not warn about the test env.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

const FILE = { name: "main.rs", type: "file" as const, path: "src/main.rs" };
const WALLET = "GABCDEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMNOPQRSTUVWX";

function jsonResponse(body: unknown) {
  return { json: async () => body } as unknown as Response;
}

function renderFileCache(fetchMock: Mock) {
  vi.stubGlobal("fetch", fetchMock);
  const onLog = vi.fn();
  const onError = vi.fn();
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  const result: { current: ReturnType<typeof useFileCache> } = {
    current: undefined as unknown as ReturnType<typeof useFileCache>,
  };

  function Probe() {
    result.current = useFileCache(WALLET, onLog, onError, "proj");
    return null;
  }

  act(() => {
    root.render(createElement(Probe));
  });

  return {
    result,
    onLog,
    onError,
    unmount: () => {
      act(() => root.unmount());
      container.remove();
    },
  };
}

function sentBody(fetchMock: Mock, callIndex: number) {
  const init = fetchMock.mock.calls[callIndex][1] as RequestInit;
  return JSON.parse(init.body as string) as Record<string, unknown>;
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("useFileCache", () => {
  it("loads a file on a cache miss, caches it and opens it", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ success: true, content: "fn main() {}" }));
    const { result } = renderFileCache(fetchMock);

    await act(async () => {
      await result.current.handleFileClick(FILE);
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(sentBody(fetchMock, 0)).toEqual({
      action: "getFileContent",
      walletAddress: WALLET,
      filePath: "src/main.rs",
      projectName: "proj",
    });
    expect(result.current.fileContents.get("src/main.rs")).toBe("fn main() {}");
    expect(result.current.openFile?.path).toBe("src/main.rs");
  });

  it("serves a second click from the cache without refetching", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ success: true, content: "cached" }));
    const { result } = renderFileCache(fetchMock);

    await act(async () => {
      await result.current.handleFileClick(FILE);
    });
    await act(async () => {
      await result.current.handleFileClick(FILE);
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("saves the current cached content for the open file", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ success: true, content: "v1" }))
      .mockResolvedValueOnce(jsonResponse({ success: true }));
    const { result } = renderFileCache(fetchMock);

    await act(async () => {
      await result.current.handleFileClick(FILE);
    });
    await act(async () => {
      await result.current.handleSave();
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(sentBody(fetchMock, 1)).toEqual({
      action: "saveFileContent",
      walletAddress: WALLET,
      filePath: "src/main.rs",
      content: "v1",
      projectName: "proj",
    });
    expect(result.current.fileContents.get("src/main.rs")).toBe("v1");
  });

  it("evicting an entry (as the delete flow does) forces a refetch", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ success: true, content: "stale" }));
    const { result } = renderFileCache(fetchMock);

    await act(async () => {
      await result.current.handleFileClick(FILE);
    });
    expect(result.current.fileContents.has("src/main.rs")).toBe(true);

    // Mirrors how useFileDelete invalidates the cache after a successful delete.
    act(() => {
      result.current.setFileContents((prev) => {
        const next = new Map(prev);
        next.delete("src/main.rs");
        return next;
      });
    });

    expect(result.current.fileContents.has("src/main.rs")).toBe(false);

    await act(async () => {
      await result.current.handleFileClick(FILE);
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not fetch for folders", async () => {
    const fetchMock = vi.fn();
    const { result } = renderFileCache(fetchMock);

    await act(async () => {
      await result.current.handleFileClick({
        name: "src",
        type: "folder",
        path: "src",
      });
    });

    expect(fetchMock).not.toHaveBeenCalled();
  });
});
