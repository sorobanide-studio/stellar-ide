import { describe, expect, it } from "vitest";

import { LSP_CAPABILITIES } from "../../lib/lsp/capabilities";
import { requestSignatureHelp } from "../../lib/lsp/requests";
import {
  LSP_REQUEST_CAPABILITIES,
  PROVIDER_REGISTRATIONS,
  type ProviderCapability,
} from "../../components/Editor/providerCapabilities";

const textDocument = LSP_CAPABILITIES.textDocument;

// Capabilities the client advertises that intentionally have no Monaco provider:
// diagnostics and sync are transport concerns, range formatting is unused, and
// signatureHelp is served by requestSignatureHelp but has no provider yet.
const CAPABILITIES_WITHOUT_A_PROVIDER: ProviderCapability[] = [
  "publishDiagnostics",
  "synchronization",
  "rangeFormatting",
  "signatureHelp",
];

describe("Monaco provider / LSP capability parity", () => {
  const providerCapabilities = PROVIDER_REGISTRATIONS.map((entry) => entry.capability);

  it("reads the real provider registry instead of re-typing the list", () => {
    expect(PROVIDER_REGISTRATIONS.length).toBeGreaterThan(0);
    for (const entry of PROVIDER_REGISTRATIONS) {
      expect(typeof entry.register).toBe("function");
      expect(typeof entry.capability).toBe("string");
    }
  });

  it("declares a textDocument capability for every registered provider", () => {
    for (const { capability } of PROVIDER_REGISTRATIONS) {
      expect(LSP_CAPABILITIES.textDocument).toHaveProperty(capability);
    }
  });

  it("does not register the same capability twice", () => {
    expect(new Set(providerCapabilities).size).toBe(providerCapabilities.length);
  });

  it("flags advertised capability keys that no provider consumes", () => {
    const consumed = new Set(providerCapabilities);
    const unconsumed = (Object.keys(textDocument) as ProviderCapability[])
      .filter((key) => !consumed.has(key))
      .sort();

    // Anything advertised but unused must be a known non-provider capability;
    // an unexpected key here means the client advertises a feature nothing uses.
    expect(unconsumed).toEqual([...CAPABILITIES_WITHOUT_A_PROVIDER].sort());
  });

  it("asserts requestSignatureHelp has a declared signatureHelp capability", () => {
    expect(typeof requestSignatureHelp).toBe("function");

    const capability = LSP_REQUEST_CAPABILITIES.requestSignatureHelp;
    expect(capability).toBe("signatureHelp");
    expect(LSP_CAPABILITIES.textDocument).toHaveProperty(capability);
  });

  it("declares a capability for every LSP request function", () => {
    for (const capability of Object.values(LSP_REQUEST_CAPABILITIES)) {
      expect(LSP_CAPABILITIES.textDocument).toHaveProperty(capability);
    }
  });
});
