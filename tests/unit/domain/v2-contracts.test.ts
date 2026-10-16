import { describe, expect, it } from "vitest";
import { namingProfileSchema } from "../../../src/domain/project/profile";
import {
  candidateDecisionSchema,
  candidatePoolSchema,
} from "../../../src/domain/candidate/decision";
import { ruleEvidenceSchema } from "../../../src/domain/rules/result";
import { candidateScoreSchema } from "../../../src/domain/rules/candidateScore";
import { assessmentRunSchema } from "../../../src/domain/rules/assessmentRun";

const moduleConfig = (weight: number) => ({
  analysisEnabled: true,
  detailsVisible: true,
  weight,
  schoolId: "erya-default",
  ruleVersion: "1",
});

const validProfile = {
  projectId: "project-song",
  configRevision: 3,
  basics: {
    surname: "宋",
    surnameType: "single",
    givenNameLength: 2,
    genderExpression: "unrestricted",
    styleTags: ["清朗自然"],
    writingComplexity: "balanced",
    pinyinFriendly: true,
  },
  family: {
    constraintKnowledge: "none",
    requiredCharacters: [],
    generationCharacters: [],
    avoidCharacters: ["病"],
    relativeNames: [],
    forbiddenCombinations: [],
  },
  inspiration: {
    sources: ["poetry", "modern", "historical"],
  },
  calendar: {
    timeKnown: false,
    timeZone: "Asia/Shanghai",
    dayBoundary: "midnight",
    zodiacConvention: "pillar",
  },
  modules: {
    bazi_wuxing: moduleConfig(20),
    zodiac: moduleConfig(5),
    traditional: moduleConfig(5),
    name_hexagram: moduleConfig(7.5),
    five_grids: moduleConfig(7.5),
  },
  scoring: {
    presetId: "full-professional",
    presetVersion: "1",
    basicWeight: 55,
  },
};

const validEvidence = {
  id: "evidence-1",
  projectId: "project-song",
  candidateId: "candidate-1",
  moduleId: "zodiac",
  dimensionId: "radical-advisory",
  ruleId: "zodiac-radical-hints",
  ruleVersion: "zodiac-radical-hints-v1",
  schoolId: "zodiac-radical-hints-v1",
  severity: "soft",
  status: "notice",
  applicability: "applied",
  scoreBefore: 100,
  deduction: 5,
  scoreAfter: 95,
  explanation: "生肖部首只作为民俗提示。",
  inputSummary: "生肖龙；名字宋清扬",
  inputHash: "sha256:evidence-input",
  calculation: ["维度初始 100 分", "命中提示项，扣 5 分"],
  sourceIds: ["zodiac-source-1"],
};

describe("v2 domain contracts", () => {
  it("accepts a versioned profile with independently controlled folklore modules", () => {
    const profile = namingProfileSchema.parse(validProfile);

    expect(profile.configRevision).toBe(3);
    expect(profile.modules.bazi_wuxing.analysisEnabled).toBe(true);
    expect(profile.modules.five_grids.weight).toBe(7.5);
  });

  it("rejects an enabled module with zero weight and the removed folklore wrapper", () => {
    expect(
      namingProfileSchema.safeParse({
        ...validProfile,
        modules: {
          ...validProfile.modules,
          zodiac: { ...validProfile.modules.zodiac, weight: 0 },
        },
      }).success,
    ).toBe(false);

    expect(
      namingProfileSchema.safeParse({
        ...validProfile,
        modules: undefined,
        folklore: { enabled: true, usefulElements: ["wood"], includeInRanking: true },
      }).success,
    ).toBe(false);
  });

  it("accepts exactly the four v2 candidate pools", () => {
    expect(
      ["inspiration", "candidate", "selected", "excluded"].map((pool) =>
        candidatePoolSchema.parse(pool),
      ),
    ).toEqual(["inspiration", "candidate", "selected", "excluded"]);
    expect(candidatePoolSchema.safeParse("favorite").success).toBe(false);
  });

  it("requires excluded candidates to retain their original pool and audit metadata", () => {
    const decision = candidateDecisionSchema.parse({
      candidateId: "candidate-1",
      projectId: "project-song",
      pool: "excluded",
      lastActivePool: "candidate",
      exclusionReason: "与长辈同音",
      excludedAt: "2026-10-16T08:00:00.000Z",
      updatedAt: "2026-10-16T08:00:00.000Z",
    });

    expect(decision.lastActivePool).toBe("candidate");
    expect(
      candidateDecisionSchema.safeParse({
        candidateId: "candidate-2",
        projectId: "project-song",
        pool: "excluded",
        updatedAt: "2026-10-16T08:00:00.000Z",
      }).success,
    ).toBe(false);
  });

  it("accepts traceable rule evidence and rejects invalid evidence states", () => {
    expect(ruleEvidenceSchema.parse(validEvidence).scoreAfter).toBe(95);
    expect(ruleEvidenceSchema.safeParse({ ...validEvidence, status: "warn" }).success).toBe(
      false,
    );
    expect(ruleEvidenceSchema.safeParse({ ...validEvidence, deduction: -1 }).success).toBe(
      false,
    );
  });

  it("accepts a bounded candidate score and rejects inconsistent score summaries", () => {
    const score = candidateScoreSchema.parse({
      candidateId: "candidate-1",
      projectId: "project-song",
      configRevision: 3,
      inputHash: "sha256:candidate-input",
      hardStatus: "pass",
      totalScore: 91.25,
      completeness: 0.8,
      evaluatedDimensions: 8,
      expectedDimensions: 10,
      hiddenScoredModuleCount: 2,
      moduleScores: { basic: 96, zodiac: 90 },
      topDeductions: [
        { ruleId: "zodiac-radical-hints", deduction: 5, explanation: "命中提示项" },
      ],
    });

    expect(score.hiddenScoredModuleCount).toBe(2);
    expect(candidateScoreSchema.safeParse({ ...score, totalScore: 101 }).success).toBe(false);
    expect(
      candidateScoreSchema.safeParse({
        ...score,
        evaluatedDimensions: 11,
        expectedDimensions: 10,
      }).success,
    ).toBe(false);
  });

  it("accepts revision-bound assessment progress and rejects impossible progress", () => {
    const run = assessmentRunSchema.parse({
      projectId: "project-song",
      runId: "run-4",
      configRevision: 4,
      status: "running",
      completed: 40,
      total: 100,
    });

    expect(run.completed).toBe(40);
    expect(assessmentRunSchema.safeParse({ ...run, completed: 101, total: 100 }).success).toBe(
      false,
    );
    expect(assessmentRunSchema.safeParse({ ...run, status: "done-ish" }).success).toBe(false);
  });
});
