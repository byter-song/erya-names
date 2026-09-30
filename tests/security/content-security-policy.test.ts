import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("deployment security headers", () => {
  it("allows only self-hosted scripts and fonts and forbids framing/workers", async () => {
    const headers = await readFile("public/_headers", "utf8");
    expect(headers).toContain("default-src 'self'");
    expect(headers).toContain("script-src 'self'");
    expect(headers).toContain("font-src 'self'");
    expect(headers).toContain("frame-ancestors 'none'");
    expect(headers).toContain("worker-src 'none'");
    expect(headers).toContain("Strict-Transport-Security");
  });
});
