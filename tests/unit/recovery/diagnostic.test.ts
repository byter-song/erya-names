import { describe, expect, it } from "vitest";
import { buildDiagnosticBundle } from "../../../src/infrastructure/diagnostics/buildDiagnosticBundle";

const CHECKSUM = `sha256:${"a".repeat(64)}`;

describe("buildDiagnosticBundle", () => {
  it("keeps only troubleshooting metadata from the supported diagnostic schema", () => {
    const diagnostic = buildDiagnosticBundle({
      appVersion: "0.3.0",
      databaseVersion: 1,
      errors: ["schema-incompatible", "missing-table:profiles", "invalid-metadata"],
      counts: { projects: 2, profiles: 2, candidates: 24 },
      rulePacks: [{ moduleId: "bazi_wuxing", checksum: CHECKSUM }],
      recentAssessmentRun: {
        status: "completed",
        configRevision: 4,
        completed: 24,
        total: 24,
      },
    });

    expect(diagnostic).toEqual({
      format: "erya-names-diagnostic",
      appVersion: "0.3.0",
      databaseVersion: 1,
      errors: ["schema-incompatible", "missing-table:profiles", "invalid-metadata"],
      counts: { projects: 2, profiles: 2, candidates: 24 },
      rulePacks: [{ moduleId: "bazi_wuxing", checksum: CHECKSUM }],
      recentAssessmentRun: {
        status: "completed",
        configRevision: 4,
        completed: 24,
        total: 24,
      },
    });
  });

  it("drops private configuration and collapses unrecognized strings", () => {
    const privateText = "宋清扬-2026-02-04T16:27-甲辰乙丑-祖父宋山-个人备注";
    const unsafeInput = {
      appVersion: "0.3.0",
      databaseVersion: 1,
      errors: [
        "database-open-failed",
        `database-open-failed:${privateText}`,
        `missing-table:${privateText}`,
      ],
      counts: { projects: 1, candidates: 12, [privateText]: 1 },
      rulePacks: [
        { moduleId: "zodiac", checksum: CHECKSUM, note: privateText },
        { moduleId: privateText, checksum: CHECKSUM },
        { moduleId: "traditional", checksum: privateText },
      ],
      recentAssessmentRun: {
        status: "failed",
        configRevision: 2,
        completed: 3,
        total: 12,
        projectId: privateText,
        runId: privateText,
      },
      birthLocalDateTime: privateText,
      pillars: privateText,
      relativeNames: [privateText],
      personalNote: privateText,
    };

    const diagnostic = buildDiagnosticBundle(unsafeInput);
    const serialized = JSON.stringify(diagnostic);

    expect(diagnostic.errors).toEqual(["database-open-failed", "unknown-error"]);
    expect(diagnostic.counts).toEqual({ projects: 1, candidates: 12 });
    expect(diagnostic.rulePacks).toEqual([{ moduleId: "zodiac", checksum: CHECKSUM }]);
    expect(diagnostic.recentAssessmentRun).toEqual({
      status: "failed",
      configRevision: 2,
      completed: 3,
      total: 12,
    });
    expect(serialized).not.toContain(privateText);
    expect(serialized).not.toMatch(/birth|pillar|relative|note/i);
  });

  it("normalizes malformed values instead of serializing them", () => {
    const diagnostic = buildDiagnosticBundle({
      appVersion: "private-version:宋清扬",
      databaseVersion: Number.NaN,
      errors: ["private-error:宋清扬"],
      counts: { projects: -2, profiles: Number.POSITIVE_INFINITY, candidates: 2.8 },
      recentAssessmentRun: {
        status: "completed",
        configRevision: 1,
        completed: 3,
        total: 2,
      },
    });

    expect(diagnostic).toEqual({
      format: "erya-names-diagnostic",
      appVersion: "unknown",
      databaseVersion: 0,
      errors: ["unknown-error"],
      counts: { candidates: 2 },
    });
    expect(JSON.stringify(diagnostic)).not.toContain("宋清扬");
  });
});
