import { describe, expect, it, vi } from "vitest";
import { applyMarkersToEditor, findMatchingModel } from "@/lib/lsp/diagnostics";
import type { MonacoModel } from "@/lib/lsp/types";

function model(uri: string): MonacoModel {
  return { uri: { toString: () => uri } };
}

const models = [
  model("file:///home/developer/workspace/contract-a/src/lib.rs"),
  model("file:///home/developer/workspace/contract-b/src/lib.rs"),
  model("file:///home/developer/workspace/contract-b/src/contract.rs"),
];

describe("findMatchingModel", () => {
  it("resolves the correct lib.rs among two same-named files by path", () => {
    const match = findMatchingModel(
      models,
      "file:///home/developer/workspace/contract-b/src/lib.rs",
    );
    expect(match).toBe(models[1]);
  });

  it("does not fall back to the first .rs model for an unknown uri", () => {
    expect(
      findMatchingModel(models, "file:///home/developer/workspace/contract-c/src/lib.rs"),
    ).toBeNull();
  });

  it("returns null for a non-.rs uri with no exact match", () => {
    expect(findMatchingModel(models, "file:///elsewhere/readme.md")).toBeNull();
  });
});

describe("applyMarkersToEditor", () => {
  it("applies zero markers and logs the uri when nothing matches", () => {
    const setModelMarkers = vi.fn();
    const onlyModels = [model("file:///a/src/lib.rs")];
    (globalThis as unknown as { window: unknown }).window = {
      monacoInstance: {
        editor: {
          getModels: () => onlyModels,
          setModelMarkers,
        },
      },
    };
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const log = vi.spyOn(console, "log").mockImplementation(() => {});

    applyMarkersToEditor("file:///b/src/main.rs", [
      {
        startLineNumber: 1,
        startColumn: 1,
        endLineNumber: 1,
        endColumn: 2,
        message: "boom",
        severity: 8,
      },
    ]);

    expect(setModelMarkers).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("file:///b/src/main.rs"));

    warn.mockRestore();
    log.mockRestore();
  });
});
