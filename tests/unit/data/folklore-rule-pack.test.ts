import { describe, expect, it } from "vitest";
import {
  auditFolkloreRuleDocument,
  auditFolkloreRulePacks,
  type FolkloreRulePackManifest,
} from "../../../scripts/data/audit-folklore";

const validManifest = (overrides: Partial<FolkloreRulePackManifest> = {}) => ({
  moduleId: "zodiac" as const,
  schoolId: "zodiac-radical-hints-v1",
  ruleVersion: "1.0.0",
  reviewStatus: "reviewed" as const,
  epistemicStatus: "school_specific" as const,
  uncertainty: "测试流派结论存在不确定性。",
  reviewedAt: "2026-10-16",
  reviewedBy: "erya-maintainer",
  sourceIds: ["source-a"],
  applicableInputs: ["zodiac", "nameCharacters"],
  checksum: `sha256:${"a".repeat(64)}`,
  sources: [
    {
      id: "source-a",
      title: "Source A",
      locator: "local://source-a",
      pageOrSection: "p. 1",
      verificationStatus: "image_checked" as const,
    },
  ],
  ...overrides,
});

describe("folklore rule pack audit", () => {
  it("rejects research-only packs from default presets", () => {
    const manifest = validManifest({ reviewStatus: "research_only" });
    const result = auditFolkloreRulePacks({
      manifests: [manifest],
      defaultPresetPackIds: [
        `${manifest.moduleId}/${manifest.schoolId}/${manifest.ruleVersion}`,
      ],
    });

    expect(result.ok).toBe(false);
    expect(result.issues).toContainEqual(
      expect.objectContaining({ code: "research-only-default" }),
    );
  });

  it("rejects duplicate module, school and version tuples", () => {
    const manifest = validManifest();
    const result = auditFolkloreRulePacks({
      manifests: [manifest, { ...manifest, checksum: `sha256:${"b".repeat(64)}` }],
      defaultPresetPackIds: [],
    });

    expect(result.ok).toBe(false);
    expect(result.issues).toContainEqual(
      expect.objectContaining({ code: "duplicate-pack-version" }),
    );
  });

  it("rejects missing source records and dangling source ids", () => {
    const result = auditFolkloreRulePacks({
      manifests: [validManifest({ sources: [] })],
      defaultPresetPackIds: [],
    });

    expect(result.ok).toBe(false);
    expect(result.issues).toContainEqual(expect.objectContaining({ code: "missing-source" }));
  });

  it("rejects malformed checksums", () => {
    const result = auditFolkloreRulePacks({
      manifests: [validManifest({ checksum: "sha256:not-a-digest" })],
      defaultPresetPackIds: [],
    });

    expect(result.ok).toBe(false);
    expect(result.issues).toContainEqual(expect.objectContaining({ code: "invalid-checksum" }));
  });

  it("requires zodiac packs to remain soft, capped and dispute-labelled", () => {
    const result = auditFolkloreRuleDocument(validManifest(), {
      behavior: {
        adviceOnly: false,
        filtersCandidates: true,
        blocksProgression: true,
        emitsHardConflict: true,
      },
      scoring: { avoidDeduction: 8, preferBonus: 1, moduleDeductionCap: 21 },
      rules: [
        {
          id: "dragon-example",
          zodiac: "龙",
          position: "any",
          characters: ["逸"],
          direction: "avoid",
          deduction: 8,
          explanation: "fixture",
          sourceId: "source-a",
        },
      ],
    });

    expect(result).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "unsafe-zodiac-behavior" }),
        expect.objectContaining({ code: "invalid-deduction-cap" }),
        expect.objectContaining({ code: "missing-controversy" }),
      ]),
    );
  });

  it("keeps five principles at zero and caps six-taboo deductions", () => {
    const manifest = validManifest({
      moduleId: "traditional",
      schoolId: "zuozhuan-naming-principles-v1",
    });
    const result = auditFolkloreRuleDocument(manifest, {
      scoring: { tabooDeduction: 5, moduleDeductionCap: 20 },
      principles: [{ id: "xin", label: "信", deduction: 5, sourceId: "source-a" }],
      taboos: [
        {
          id: "country",
          label: "国名",
          deduction: 5,
          terms: ["秦"],
          sourceId: "source-a",
          controversyStatus: "contextual",
          controversyNote: "fixture",
        },
      ],
    });

    expect(result).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "invalid-deduction-cap" }),
        expect.objectContaining({ code: "principle-deduction" }),
      ]),
    );
  });
});
