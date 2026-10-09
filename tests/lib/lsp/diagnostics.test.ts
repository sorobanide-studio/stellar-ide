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
import { describe, expect, it } from "vitest";
import { convertToMonacoMarkers } from "@/lib/lsp/diagnostics";
import type { Diagnostic } from "@/lib/lsp/types";

function makeDiagnostic(severity?: number): Diagnostic {
  const diag = {
    range: {
      start: { line: 0, character: 0 },
      end: { line: 0, character: 1 },
    },
    message: "diagnostic",
  } as Diagnostic;
  if (severity !== undefined) {
    diag.severity = severity;
  }
  return diag;
}

describe("convertToMonacoMarkers severity mapping", () => {
  it("maps LSP Hint (4) to Monaco Hint (1)", () => {
    expect(convertToMonacoMarkers([makeDiagnostic(4)])[0].severity).toBe(1);
  });

  it("maps LSP Information (3) to Monaco Info (2)", () => {
    expect(convertToMonacoMarkers([makeDiagnostic(3)])[0].severity).toBe(2);
  });

  it.each([
    [1, 8],
    [2, 4],
  ])("maps LSP severity %i to Monaco severity %i", (lsp, monaco) => {
    expect(convertToMonacoMarkers([makeDiagnostic(lsp)])[0].severity).toBe(monaco);
  });

  it("maps a diagnostic with no severity to Monaco 8 (LSP default is 1 = Error)", () => {
    expect(convertToMonacoMarkers([makeDiagnostic()])[0].severity).toBe(8);
  });

  it("never renders a hint as an information squiggle", () => {
    const hint = convertToMonacoMarkers([makeDiagnostic(4)])[0].severity;
    const info = convertToMonacoMarkers([makeDiagnostic(3)])[0].severity;
    expect(hint).not.toBe(info);
  });
});
