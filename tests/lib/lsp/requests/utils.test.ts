import { describe, expect, it } from "vitest";
import { createRequestId } from "../../../../lib/lsp/requests/utils";

describe("createRequestId", () => {
  it("returns 10,000 distinct ids for 10,000 sequential calls", () => {
    const ids: number[] = [];
    for (let i = 0; i < 10000; i++) {
      ids.push(createRequestId());
    }

    const distinct = new Set(ids);
    expect(distinct.size).toBe(10000);
  });

  it("returns a safe integer", () => {
    const ids = Array.from({ length: 100 }, () => createRequestId());
    for (const id of ids) {
      expect(Number.isInteger(id)).toBe(true);
      expect(Number.isSafeInteger(id)).toBe(true);
    }
  });

  it("returns ids in non-decreasing order", () => {
    let previous = createRequestId();
    for (let i = 0; i < 1000; i++) {
      const next = createRequestId();
      expect(next).toBeGreaterThan(previous);
      previous = next;
    }
  });
});
