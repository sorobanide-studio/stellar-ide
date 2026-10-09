import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ProblemsPanel from "../../components/ProblemsPanel";
import BottomPanel from "../../components/BottomPanel";
import type { DiagnosticItem } from "../../hooks/useDiagnosticsStore";

const diagnostics: DiagnosticItem[] = [
  {
    id: "diag-1",
    uri: "file:///home/developer/workspace/soroban-hello-world/src/lib.rs",
    message: "unused variable `count`",
    severity: 1,
    range: {
      start: { line: 0, character: 0 },
      end: { line: 0, character: 5 },
    },
  },
];

function renderProblems(): string {
  return renderToStaticMarkup(
    createElement(ProblemsPanel, {
      diagnostics,
      onDiagnosticClick: () => {},
    })
  ).replace(/<!-- -->/g, "");
}

describe("problems panel accessibility", () => {
  it("exposes a labelled region and a list of focusable items", () => {
    const html = renderProblems();
    expect(html).toContain('role="region"');
    expect(html).toContain('aria-label="Problems"');
    expect(html).toContain('role="list"');
    expect(html).toContain('role="listitem"');
    expect(html).toContain('tabindex="0"');
  });

  it("exposes severity as text rather than colour alone", () => {
    const html = renderProblems();
    expect(html).toContain("Error:");
  });

  it("gives the terminal a log role and an accessible name", () => {
    const html = renderToStaticMarkup(
      createElement(BottomPanel, {
        isOpen: true,
        onClose: () => {},
        height: 250,
        onHeightChange: () => {},
        terminalLogs: [],
        diagnostics: [],
        onDiagnosticClick: () => {},
      })
    );
    expect(html).toContain('role="log"');
    expect(html).toContain('aria-label="Console output"');
  });
});
