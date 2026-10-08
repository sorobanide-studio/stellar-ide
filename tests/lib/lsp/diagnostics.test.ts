import { afterEach, describe, expect, it, vi } from "vitest";
import {
  applyMarkersToEditor,
  convertToMonacoMarkers,
  findMatchingModel,
} from "../../../lib/lsp/diagnostics";
import type {
  Diagnostic,
  MonacoMarker,
  MonacoModel,
} from "../../../lib/lsp/types";

function diagnostic(severity: number): Diagnostic {
  return {
    range: {
      start: { line: 2, character: 3 },
      end: { line: 4, character: 5 },
    },
    message: "unused variable",
    severity,
  };
}

function model(uri: string): MonacoModel {
  return { uri: { toString: () => uri } };
}

afterEach(() => {
  Reflect.deleteProperty(globalThis, "window");
});

describe("convertToMonacoMarkers", () => {
  it("converts 0-based LSP positions to 1-based Monaco positions", () => {
    const [marker] = convertToMonacoMarkers([diagnostic(1)]);

    expect(marker).toEqual({
      startLineNumber: 3,
      startColumn: 4,
      endLineNumber: 5,
      endColumn: 6,
      message: "unused variable",
      severity: 8,
    });
  });

  it("maps Error/Warning/Info/Hint to 8/4/2/1", () => {
    const markers = convertToMonacoMarkers([
      diagnostic(1),
      diagnostic(2),
      diagnostic(3),
      diagnostic(4),
    ]);

    expect(markers.map((m) => m.severity)).toEqual([8, 4, 2, 1]);
    // Hint (LSP 4) has an explicit expectation: Monaco Hint === 1.
    expect(markers[3].severity).toBe(1);
  });

  it("preserves the diagnostic message", () => {
    const markers = convertToMonacoMarkers([diagnostic(2)]);
    expect(markers[0].message).toBe("unused variable");
  });
});

describe("findMatchingModel", () => {
  it("resolves two models with the same filename by full URI", () => {
    const models = [
      model("file:///projA/src/lib.rs"),
      model("file:///projB/src/lib.rs"),
    ];

    expect(findMatchingModel(models, "file:///projB/src/lib.rs")).toBe(
      models[1],
    );
    expect(findMatchingModel(models, "file:///projA/src/lib.rs")).toBe(
      models[0],
    );
  });

  it("falls back to a matching filename when no URI is exact", () => {
    const models = [
      model("file:///projA/src/util.rs"),
      model("file:///projB/src/other.rs"),
    ];

    expect(findMatchingModel(models, "file:///projC/src/util.rs")).toBe(
      models[0],
    );
  });

  it("returns null when nothing matches", () => {
    expect(findMatchingModel([], "file:///projA/src/lib.rs")).toBeNull();
    expect(
      findMatchingModel(
        [model("file:///x/notes.txt")],
        "file:///y/other.rs",
      ),
    ).toBeNull();
  });
});

describe("applyMarkersToEditor", () => {
  it("does not throw when window.monacoInstance is undefined", () => {
    (globalThis as unknown as { window: unknown }).window = {};

    expect(() => applyMarkersToEditor("file:///x/lib.rs", [], 0)).not.toThrow();
  });

  it("falls back to the first .rs model when the URI matches nothing", () => {
    const setModelMarkers = vi.fn();
    const rsModel = model("file:///y/bar.rs");
    (globalThis as unknown as { window: unknown }).window = {
      monacoInstance: {
        editor: {
          getModels: () => [rsModel],
          setModelMarkers,
        },
      },
    };

    const markers: MonacoMarker[] = convertToMonacoMarkers([diagnostic(1)]);
    applyMarkersToEditor("file:///x/foo.ts", markers);

    expect(setModelMarkers).toHaveBeenCalledTimes(2);
    expect(setModelMarkers).toHaveBeenNthCalledWith(
      1,
      rsModel,
      "rust-analyzer",
      [],
    );
    expect(setModelMarkers).toHaveBeenNthCalledWith(
      2,
      rsModel,
      "rust-analyzer",
      markers,
    );
  });

  it("sets markers on the exact model when the URI matches", () => {
    const setModelMarkers = vi.fn();
    const target = model("file:///projB/src/lib.rs");
    const other = model("file:///projA/src/lib.rs");
    (globalThis as unknown as { window: unknown }).window = {
      monacoInstance: {
        editor: {
          getModels: () => [other, target],
          setModelMarkers,
        },
      },
    };

    applyMarkersToEditor("file:///projB/src/lib.rs", []);

    expect(setModelMarkers).toHaveBeenLastCalledWith(
      target,
      "rust-analyzer",
      [],
    );
  });
});
