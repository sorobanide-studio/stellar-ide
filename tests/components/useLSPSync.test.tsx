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
