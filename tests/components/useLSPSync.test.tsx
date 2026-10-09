import { describe, expect, it } from "vitest";
import { createContentTracker } from "../../components/Editor/useLSPSync";
import { createDocumentVersionStore } from "../../lib/lsp/hooks/useLSPDocumentSync";

const A = "file:///home/developer/workspace/proj/src/a.rs";
const B = "file:///home/developer/workspace/proj/src/b.rs";

describe("per-document LSP sync state", () => {
  it("tracks didChange content per uri across a two-file session", () => {
    const tracker = createContentTracker();

    // First sighting of A is a change.
    expect(tracker.hasChanged(A, "a1")).toBe(true);
    // Same content again is not.
    expect(tracker.hasChanged(A, "a1")).toBe(false);

    // Switching to B with its own content is a change, even though a single
    // global snapshot would have compared it against A's content.
    expect(tracker.hasChanged(B, "b1")).toBe(true);

    // Switching back to A (unchanged) must not resend.
    expect(tracker.hasChanged(A, "a1")).toBe(false);
    // Editing A must resend...
    expect(tracker.hasChanged(A, "a2")).toBe(true);
    // ...while B stays unchanged and is not resent.
    expect(tracker.hasChanged(B, "b1")).toBe(false);
    // Editing B independently is tracked too.
    expect(tracker.hasChanged(B, "b2")).toBe(true);
  });

  it("keeps a strictly increasing version sequence per uri", () => {
    const store = createDocumentVersionStore();

    expect(store.open(A)).toBe(1);
    expect(store.change(A)).toBe(2);
    expect(store.change(A)).toBe(3);

    expect(store.open(B)).toBe(1);
    expect(store.change(B)).toBe(2);

    // Interleaved edits keep each document monotonic.
    expect(store.change(A)).toBe(4);
    expect(store.change(B)).toBe(3);
    expect(store.change(A)).toBe(5);

    expect(store.versionOf(A)).toBe(5);
    expect(store.versionOf(B)).toBe(3);
  });

  it("restarts the version sequence after a document is closed", () => {
    const store = createDocumentVersionStore();

    expect(store.open(A)).toBe(1);
    store.change(A);
    store.change(A);
    expect(store.versionOf(A)).toBe(3);

    store.close(A);
    expect(store.isOpen(A)).toBe(false);
    expect(store.versionOf(A)).toBeUndefined();

    // Re-open starts a fresh sequence.
    expect(store.open(A)).toBe(1);
    expect(store.change(A)).toBe(2);
  });
});
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { useLSPSync } from "../../components/Editor/useLSPSync";
import { LSP_CHANGE_DEBOUNCE_MS } from "../../components/Editor/constants";
import { invalidateHintsCache } from "../../components/Editor/inlayHints";

vi.mock("../../components/Editor/inlayHints", () => ({
  invalidateHintsCache: vi.fn(),
}));

// React 19 requires this flag so `act(...)` does not warn about the test env.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

interface SyncParams {
  isConnected: boolean;
  openFile: { name: string; type: "file" | "folder"; path: string } | null;
  fileUri: string;
  fileContents: Map<string, string>;
  openTextDocument: Mock;
  changeTextDocument: Mock;
}

function renderSync(initial: SyncParams) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  let current = initial;

  function Probe() {
    useLSPSync(current);
    return null;
  }

  act(() => {
    root.render(createElement(Probe));
  });

  return {
    rerender: (next: SyncParams) => {
      current = next;
      act(() => {
        root.render(createElement(Probe));
      });
    },
    unmount: () => {
      act(() => root.unmount());
      container.remove();
    },
  };
}

const MAIN = { name: "main.rs", type: "file" as const, path: "src/main.rs" };
const MAIN_URI = "file:///src/main.rs";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe("useLSPSync", () => {
  it("never opens or changes a non-Rust file", () => {
    const openTextDocument = vi.fn();
    const changeTextDocument = vi.fn();

    renderSync({
      isConnected: true,
      openFile: { name: "App.tsx", type: "file", path: "src/App.tsx" },
      fileUri: "file:///src/App.tsx",
      fileContents: new Map([["src/App.tsx", "const x = 1;"]]),
      openTextDocument,
      changeTextDocument,
    });

    vi.advanceTimersByTime(1000);

    expect(openTextDocument).not.toHaveBeenCalled();
    expect(changeTextDocument).not.toHaveBeenCalled();
  });

  it("opens a Rust file once and does not re-open it for identical props", () => {
    const openTextDocument = vi.fn();
    const changeTextDocument = vi.fn();
    const params: SyncParams = {
      isConnected: true,
      openFile: MAIN,
      fileUri: MAIN_URI,
      fileContents: new Map([["src/main.rs", "fn main() {}"]]),
      openTextDocument,
      changeTextDocument,
    };

    const { rerender } = renderSync(params);
    expect(openTextDocument).toHaveBeenCalledTimes(1);
    expect(openTextDocument).toHaveBeenCalledWith(
      "fn main() {}",
      MAIN_URI,
    );

    rerender(params);
    expect(openTextDocument).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(1000);
  });

  it("collapses rapid edits into a single debounced change", () => {
    const openTextDocument = vi.fn();
    const changeTextDocument = vi.fn();
    const base: Omit<SyncParams, "fileContents"> = {
      isConnected: true,
      openFile: MAIN,
      fileUri: MAIN_URI,
      openTextDocument,
      changeTextDocument,
    };

    const { rerender } = renderSync({
      ...base,
      fileContents: new Map([["src/main.rs", "v1"]]),
    });
    rerender({ ...base, fileContents: new Map([["src/main.rs", "v2"]]) });
    rerender({ ...base, fileContents: new Map([["src/main.rs", "v3"]]) });

    expect(changeTextDocument).not.toHaveBeenCalled();

    vi.advanceTimersByTime(LSP_CHANGE_DEBOUNCE_MS);

    expect(changeTextDocument).toHaveBeenCalledTimes(1);
    expect(changeTextDocument).toHaveBeenCalledWith("v3", MAIN_URI);
  });

  it("resets the debounce when switching files so the old timer never fires", () => {
    const openTextDocument = vi.fn();
    const changeTextDocument = vi.fn();
    const fileB = { name: "lib.rs", type: "file" as const, path: "src/lib.rs" };
    const uriB = "file:///src/lib.rs";

    const { rerender } = renderSync({
      isConnected: true,
      openFile: MAIN,
      fileUri: MAIN_URI,
      fileContents: new Map([["src/main.rs", "alpha"]]),
      openTextDocument,
      changeTextDocument,
    });

    vi.advanceTimersByTime(100);

    rerender({
      isConnected: true,
      openFile: fileB,
      fileUri: uriB,
      fileContents: new Map([
        ["src/main.rs", "alpha"],
        ["src/lib.rs", "beta"],
      ]),
      openTextDocument,
      changeTextDocument,
    });

    vi.advanceTimersByTime(LSP_CHANGE_DEBOUNCE_MS);

    expect(changeTextDocument).toHaveBeenCalledTimes(1);
    expect(changeTextDocument).toHaveBeenCalledWith("beta", uriB);
    expect(openTextDocument).toHaveBeenCalledWith("beta", uriB);
  });

  it("does not send a change when the content is unchanged", () => {
    const openTextDocument = vi.fn();
    const changeTextDocument = vi.fn();
    const base: Omit<SyncParams, "fileContents"> = {
      isConnected: true,
      openFile: MAIN,
      fileUri: MAIN_URI,
      openTextDocument,
      changeTextDocument,
    };

    const { rerender } = renderSync({
      ...base,
      fileContents: new Map([["src/main.rs", "same"]]),
    });
    vi.advanceTimersByTime(LSP_CHANGE_DEBOUNCE_MS);
    const initialCalls = changeTextDocument.mock.calls.length;

    rerender({
      ...base,
      fileContents: new Map([["src/main.rs", "same"]]),
    });
    vi.advanceTimersByTime(LSP_CHANGE_DEBOUNCE_MS);

    expect(changeTextDocument).toHaveBeenCalledTimes(initialCalls);
  });

  it("invalidates the inlay hints cache on a real content change", () => {
    const openTextDocument = vi.fn();
    const changeTextDocument = vi.fn();

    renderSync({
      isConnected: true,
      openFile: MAIN,
      fileUri: MAIN_URI,
      fileContents: new Map([["src/main.rs", "fn main() {}"]]),
      openTextDocument,
      changeTextDocument,
    });

    expect(invalidateHintsCache as unknown as Mock).toHaveBeenCalled();

    vi.advanceTimersByTime(1000);
  });
});
