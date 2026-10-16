import { describe, expect, it } from "vitest";
import devBundle from "../../../../src/data/curated/dev-bundle.json";
import { runtimeBundleSchema } from "../../../../src/data/schema/runtimeBundle";
import { generateCandidates } from "../../../../src/domain/generation/generateCandidates";
import { namingProfileSchema } from "../../../../src/domain/project/profile";
import { namingProfileFixture } from "../../../fixtures/namingProfile";

const bundle = runtimeBundleSchema.parse(devBundle);
const profile = namingProfileSchema.parse({
  ...namingProfileFixture("project-song"),
  basics: {
    ...namingProfileFixture("project-song").basics,
    styleTags: ["清朗自然", "文雅书卷"],
    pinyinFriendly: true,
  },
  family: { ...namingProfileFixture("project-song").family, avoidCharacters: ["病"] },
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
        family: {
          ...profile.family,
          requiredCharacters: [{ char: "清", position: 1 }],
          avoidCharacters: ["宁"],
        },
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

  it("uses baby gender only as a default soft-ranking reference", () => {
    const result = generateCandidates({
      profile: namingProfileSchema.parse({
        ...profile,
        basics: { ...profile.basics, childGender: "male", genderExpression: "unrestricted" },
      }),
      bundle,
      seed: "song-gender-reference",
      requestedCount: 10,
      allusionRatio: 0.5,
      historicalFingerprints: new Set(),
    });

    expect(
      result.candidates.some((candidate) =>
        candidate.ruleResults.some(
          (rule) =>
            rule.ruleId === "l3-expression" &&
            rule.explanation.includes("宝宝性别提供默认文字表达软排序"),
        ),
      ),
    ).toBe(true);
    expect(result.candidates).toHaveLength(10);
  });

  it("counts hard rejects and never returns a rejected candidate", () => {
    const result = generateCandidates({
      profile: namingProfileSchema.parse({
        ...profile,
        family: { ...profile.family, forbiddenCombinations: ["清扬"] },
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

  it("converts a traditional source name before character-card filtering and display", () => {
    const source = bundle.allusions.find((item) => item.selectedText === "清扬");
    if (!source) throw new Error("Expected the 清扬 fixture");
    const result = generateCandidates({
      profile: namingProfileSchema.parse({
        ...profile,
        family: {
          ...profile.family,
          requiredCharacters: [
            { char: "清", position: 1 },
            { char: "扬", position: 2 },
          ],
        },
      }),
      bundle: {
        ...bundle,
        traditionalToSimplified: { 扬: "扬", 揚: "扬" },
        allusions: [
          {
            ...source,
            selectedText: "清揚",
            title: "清揚",
            quote: "有美一人，清揚婉兮。",
            interpretation: "清秀明朗，文雅舒展。",
          },
        ],
      },
      seed: "traditional-source",
      requestedCount: 1,
      allusionRatio: 1,
      historicalFingerprints: new Set(),
    });

    expect(result.candidates[0]).toMatchObject({
      fullName: "宋清扬",
      givenName: "清扬",
      summary: "清秀明朗，文雅舒展。",
    });
    expect(result.candidates[0]?.sourceEvidence[0]?.quote).toBe("有美一人，清扬婉兮。");
  });
});
