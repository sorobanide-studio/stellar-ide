import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { BuildButton } from "../../components/BuildButton";
import { sanitizeAnnouncement } from "../../lib/a11y";

describe("build and deploy announcements", () => {
  it("exposes a polite live region and a busy state on the build button", () => {
    const html = renderToStaticMarkup(
      createElement(BuildButton, {
        onLog: () => {},
        projectName: "soroban-hello-world",
        userId: "GABCDEF",
      })
    );

    expect(html).toContain('role="status"');
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain('aria-busy="false"');
  });

  it("strips base64 payloads and truncates long announcements", () => {
    const payload = "A".repeat(200);
    const sanitized = sanitizeAnnouncement(`Deployment failed ${payload}`);

    expect(sanitized).not.toContain(payload);
    expect(sanitized).toContain("[data omitted]");
    expect(sanitized.length).toBeLessThanOrEqual(160);
  });

  it("keeps short messages intact", () => {
    expect(sanitizeAnnouncement("Build succeeded.")).toBe("Build succeeded.");
  });
});
