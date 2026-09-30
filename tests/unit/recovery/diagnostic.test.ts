import { describe, expect, it } from "vitest";
import { buildDiagnosticBundle } from "../../../src/infrastructure/diagnostics/buildDiagnosticBundle";

describe("buildDiagnosticBundle", () => {
  it("contains only versions, error codes and aggregate counts", () => {
    const diagnostic = buildDiagnosticBundle({
      appVersion: "0.2.0",
      databaseVersion: 2,
      errors: ["schema-incompatible"],
      counts: { projects: 2, candidates: 24 },
    });

    expect(diagnostic).toEqual({
      format: "erya-names-diagnostic",
      appVersion: "0.2.0",
      databaseVersion: 2,
      errors: ["schema-incompatible"],
      counts: { projects: 2, candidates: 24 },
    });
    expect(JSON.stringify(diagnostic)).not.toContain("宋");
  });
});
