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
