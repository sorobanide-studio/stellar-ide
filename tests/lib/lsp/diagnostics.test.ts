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
