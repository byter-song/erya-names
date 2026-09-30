import { describe, expect, it } from "vitest";
import devBundle from "../../../../src/data/curated/dev-bundle.json";
import { runtimeBundleSchema } from "../../../../src/data/schema/runtimeBundle";
import { generateCandidates } from "../../../../src/domain/generation/generateCandidates";
import { namingProfileSchema } from "../../../../src/domain/project/profile";

const bundle = runtimeBundleSchema.parse(devBundle);
const profile = namingProfileSchema.parse({
  projectId: "project-song",
  surname: "宋",
  surnameType: "single",
  givenNameLength: 2,
  requiredCharacters: [],
  generationCharacters: [],
  avoidCharacters: ["病"],
  relativeNames: [],
  forbiddenCombinations: [],
  genderExpression: "unrestricted",
  styleTags: ["清朗自然", "文雅书卷"],
  writingComplexity: "balanced",
  pinyinFriendly: true,
  folklore: { enabled: false, usefulElements: [], includeInRanking: false },
});

describe("generateCandidates", () => {
  it("deterministically generates reviewed Song surname candidates from both source types", () => {
    const first = generateCandidates({
      profile,
      bundle,
      seed: "song-batch-1",
      requestedCount: 12,
      allusionRatio: 0.5,
      historicalFingerprints: new Set(),
    });
    const second = generateCandidates({
      profile,
      bundle,
      seed: "song-batch-1",
      requestedCount: 12,
      allusionRatio: 0.5,
      historicalFingerprints: new Set(),
    });

    expect(first.candidates).toEqual(second.candidates);
    expect(first.candidates.length).toBe(12);
    expect(first.candidates[0]?.characterEvidence).toHaveLength(2);
    expect(
      first.candidates[0]?.characterEvidence.every((item) => item.meanings.length > 0),
    ).toBe(true);
    expect(first.candidates.every((candidate) => candidate.fullName.startsWith("宋"))).toBe(
      true,
    );
    expect(
      first.candidates.some((candidate) => candidate.sourceType === "verified_allusion"),
    ).toBe(true);
    expect(
      first.candidates.some((candidate) => candidate.sourceType === "modern_combination"),
    ).toBe(true);
  });

  it("respects required characters, avoid characters, and historical fingerprints", () => {
    const result = generateCandidates({
      profile: namingProfileSchema.parse({
        ...profile,
        requiredCharacters: [{ char: "清", position: 1 }],
        avoidCharacters: ["宁"],
      }),
      bundle,
      seed: "song-required",
      requestedCount: 6,
      allusionRatio: 0.5,
      historicalFingerprints: new Set(["宋清扬"]),
    });

    expect(result.candidates.every((candidate) => candidate.givenName.startsWith("清"))).toBe(
      true,
    );
    expect(result.candidates.every((candidate) => !candidate.fullName.includes("宁"))).toBe(
      true,
    );
    expect(result.candidates.map((candidate) => candidate.fullName)).not.toContain("宋清扬");
    expect(result.statistics.historicalRejected).toBeGreaterThan(0);
  });

  it("counts hard rejects and never returns a rejected candidate", () => {
    const result = generateCandidates({
      profile: namingProfileSchema.parse({
        ...profile,
        forbiddenCombinations: ["清扬"],
      }),
      bundle,
      seed: "song-hard-rules",
      requestedCount: 12,
      allusionRatio: 0.5,
      historicalFingerprints: new Set(),
    });

    expect(result.statistics.hardRejected).toBeGreaterThan(0);
    expect(result.candidates.map((candidate) => candidate.fullName)).not.toContain("宋清扬");
    expect(
      result.candidates.every((candidate) =>
        candidate.ruleResults.every((rule) => rule.outcome !== "reject"),
      ),
    ).toBe(true);
  });

  it("never returns candidates rejected by a reviewed L2 risk signal", () => {
    const riskBundle = {
      ...bundle,
      characters: bundle.characters.map((entry) =>
        entry.char === "安"
          ? {
              ...entry,
              riskSignals: [
                {
                  kind: "known_homophone" as const,
                  outcome: "reject" as const,
                  explanation: "测试用已复核严重谐音风险",
                  sourceRefs: ["test-review"],
                  reviewStatus: "verified" as const,
                },
              ],
            }
          : entry,
      ),
    };
    const result = generateCandidates({
      profile,
      bundle: riskBundle,
      seed: "song-l2-reject",
      requestedCount: 100,
      allusionRatio: 0.5,
      historicalFingerprints: new Set(),
    });

    expect(result.statistics.hardRejected).toBeGreaterThan(0);
    expect(result.candidates.every((candidate) => !candidate.givenName.includes("安"))).toBe(
      true,
    );
  });
});
