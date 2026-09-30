import { describe, expect, it } from "vitest";
import { evaluateBundleBudget } from "../../../scripts/quality/bundle-budget";

describe("bundle budget", () => {
  it("rejects an asset category above its raw or gzip limit", () => {
    const result = evaluateBundleBudget(
      [{ path: "assets/app.js", bytes: 101, gzipBytes: 51 }],
      { javascript: { raw: 100, gzip: 50 } },
    );
    expect(result.ok).toBe(false);
    expect(result.errors).toEqual(["javascript raw 101 > 100", "javascript gzip 51 > 50"]);
  });
});
