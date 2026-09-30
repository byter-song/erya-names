import { describe, expect, it } from "vitest";
import devBundle from "../../../../src/data/curated/dev-bundle.json";
import { runtimeBundleSchema } from "../../../../src/data/schema/runtimeBundle";
import type { GeneratedCandidate } from "../../../../src/domain/generation/generateCandidates";
import { namingProfileSchema } from "../../../../src/domain/project/profile";
import { evaluateCandidateRules } from "../../../../src/domain/rules/rulePack";

const bundle = runtimeBundleSchema.parse(devBundle);
const profile = namingProfileSchema.parse({
  projectId: "project-song",
  surname: "宋",
  surnameType: "single",
  givenNameLength: 2,
  requiredCharacters: [{ char: "清", position: 1 }],
  generationCharacters: [],
  avoidCharacters: ["病"],
  relativeNames: ["宋清扬"],
  forbiddenCombinations: ["清华"],
  genderExpression: "unrestricted",
  styleTags: [],
  writingComplexity: "balanced",
  pinyinFriendly: true,
  folklore: { enabled: false, usefulElements: [], includeInRanking: false },
});

function candidate(givenName: string, pinyin: string[] = []): GeneratedCandidate {
  return {
    id: `candidate:宋${givenName}`,
    projectId: profile.projectId,
    batchId: null,
    normalizedFingerprint: `宋${givenName}`,
    surname: "宋",
    givenName,
    fullName: `宋${givenName}`,
    pinyin,
    sourceType: "modern_combination",
    summary: "测试候选",
    sourceIds: ["standard-hanzi-2013"],
    sourceEvidence: [{ sourceId: "standard-hanzi-2013", location: "一级字表" }],
    warnings: [],
    riskSignals: [],
    ruleResults: [],
    styleTags: [],
    characterElements: [],
    createdAt: "1970-01-01T00:00:00.000Z",
  };
}

describe("evaluateCandidateRules", () => {
  it("rejects candidates without reviewed standard-character evidence", () => {
    const evaluation = evaluateCandidateRules({
      candidate: candidate("清𠮷"),
      profile: { ...profile, relativeNames: [] },
      bundle,
    });

    expect(evaluation.accepted).toBe(false);
    expect(evaluation.results).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          evidenceLevel: "L1",
          outcome: "reject",
          ruleId: "l1-standard-character",
        }),
      ]),
    );
  });

  it("validates the surname against the complete official standard-character set", () => {
    const evaluation = evaluateCandidateRules({
      candidate: { ...candidate("清安"), fullName: "𠮷清安" },
      profile: { ...profile, surname: "𠮷", relativeNames: [] },
      bundle,
    });

    expect(evaluation.accepted).toBe(false);
    expect(evaluation.results).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          ruleId: "l1-standard-character",
          outcome: "reject",
          explanation: expect.stringContaining("𠮷"),
        }),
      ]),
    );
  });

  it.each([
    ["清扬", "亲属姓名"],
    ["清华", "禁用组合"],
    ["知远", "指定字"],
  ])("rejects %s when a family constraint fails", (givenName, explanation) => {
    const evaluation = evaluateCandidateRules({
      candidate: candidate(givenName),
      profile,
      bundle,
    });

    expect(evaluation.accepted).toBe(false);
    expect(evaluation.results).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          evidenceLevel: "L1",
          outcome: "reject",
          ruleId: "l1-family-constraint",
          explanation: expect.stringContaining(explanation),
        }),
      ]),
    );
  });

  it("keeps reviewed multi-pronunciation risk as a visible L2 warning", () => {
    const evaluation = evaluateCandidateRules({
      candidate: candidate("清行", ["qīng", "xíng"]),
      profile: { ...profile, relativeNames: [] },
      bundle,
    });

    expect(evaluation.accepted).toBe(true);
    expect(evaluation.results).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          evidenceLevel: "L2",
          outcome: "warn",
          ruleId: "l2-multiple-pronunciation",
        }),
      ]),
    );
  });

  it.each([
    ["negative_meaning", "l2-negative-meaning"],
    ["known_homophone", "l2-known-homophone"],
    ["input", "l2-input-risk"],
    ["writing", "l2-writing-risk"],
  ] as const)("maps the reviewed %s signal to a versioned rule", (kind, ruleId) => {
    const input = candidate("清安");
    input.riskSignals = [
      {
        kind,
        outcome: "warn",
        explanation: "已复核风险",
        sourceRefs: ["review-source"],
        reviewStatus: "verified",
      },
    ];

    const evaluation = evaluateCandidateRules({
      candidate: input,
      profile: { ...profile, relativeNames: [] },
      bundle,
    });

    expect(evaluation.results).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ ruleId, outcome: "warn", sourceRefs: ["review-source"] }),
      ]),
    );
  });

  it("rejects a reviewed severe L2 risk", () => {
    const input = candidate("清安");
    input.riskSignals = [
      {
        kind: "known_homophone",
        outcome: "reject",
        explanation: "存在明确负面谐音",
        sourceRefs: ["review-source"],
        reviewStatus: "verified",
      },
    ];

    expect(
      evaluateCandidateRules({
        candidate: input,
        profile: { ...profile, relativeNames: [] },
        bundle,
      }).accepted,
    ).toBe(false);
  });
});
