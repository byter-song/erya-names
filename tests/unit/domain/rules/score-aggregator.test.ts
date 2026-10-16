import { describe, expect, it } from "vitest";

import type { RuleEvidence, RuleModuleId } from "../../../../src/domain/rules/result";
import {
  aggregateCandidateScore,
  compareCandidateRanking,
  type ScoreModuleConfiguration,
} from "../../../../src/domain/rules/scoring/ScoreAggregator";

const modules: Record<RuleModuleId, ScoreModuleConfiguration> = {
  basic: {
    analysisEnabled: true,
    detailsVisible: true,
    weight: 70,
    dimensionWeights: { sound: 2, meaning: 1 },
  },
  bazi_wuxing: {
    analysisEnabled: true,
    detailsVisible: false,
    weight: 20,
    dimensionWeights: { useful_god: 1 },
  },
  zodiac: {
    analysisEnabled: true,
    detailsVisible: true,
    weight: 10,
    dimensionWeights: { radicals: 1 },
  },
  traditional: disabledModule(),
  name_hexagram: disabledModule(),
  five_grids: disabledModule(),
};

describe("ScoreAggregator", () => {
  it("starts each dimension at 100 and derives every score from applied soft deductions", () => {
    const score = aggregateCandidateScore({
      candidateId: "candidate-1",
      projectId: "project-1",
      configRevision: 3,
      inputHash: "input-1",
      modules,
      evidence: [
        softEvidence({ dimensionId: "sound", ruleId: "sound-a", deduction: 12.5 }),
        softEvidence({ dimensionId: "sound", ruleId: "sound-b", deduction: 7.25 }),
        softEvidence({ dimensionId: "meaning", ruleId: "meaning-a", deduction: 0 }),
        softEvidence({
          moduleId: "bazi_wuxing",
          dimensionId: "useful_god",
          ruleId: "useful-god-a",
          deduction: 10,
        }),
        softEvidence({
          moduleId: "zodiac",
          dimensionId: "radicals",
          ruleId: "zodiac-a",
          deduction: 5,
        }),
      ],
    });

    expect(score.moduleScores.basic).toBeCloseTo((80.25 * 2 + 100) / 3, 12);
    expect(score.moduleScores.bazi_wuxing).toBe(90);
    expect(score.moduleScores.zodiac).toBe(95);
    expect(score.totalScore).toBeCloseTo(
      (((80.25 * 2 + 100) / 3) * 70 + 90 * 20 + 95 * 10) / 100,
      12,
    );
    expect(score.topDeductions.map(({ ruleId, deduction }) => ({ ruleId, deduction }))).toEqual(
      [
        { ruleId: "sound-a", deduction: 12.5 },
        { ruleId: "useful-god-a", deduction: 10 },
        { ruleId: "sound-b", deduction: 7.25 },
        { ruleId: "zodiac-a", deduction: 5 },
      ],
    );
  });

  it("normalizes enabled weights and excludes unknown dimensions and modules from denominators", () => {
    const score = aggregateCandidateScore({
      candidateId: "candidate-1",
      projectId: "project-1",
      configRevision: 3,
      inputHash: "input-1",
      modules,
      evidence: [
        softEvidence({ dimensionId: "sound", deduction: 25 }),
        unknownEvidence({ dimensionId: "meaning" }),
        unknownEvidence({ moduleId: "bazi_wuxing", dimensionId: "useful_god" }),
        softEvidence({ moduleId: "zodiac", dimensionId: "radicals", deduction: 5 }),
      ],
    });

    expect(score.moduleScores).toEqual({ basic: 75, zodiac: 95 });
    expect(score.totalScore).toBeCloseTo((75 * 70 + 95 * 10) / 80, 12);
    expect(score.evaluatedDimensions).toBe(2);
    expect(score.expectedDimensions).toBe(4);
    expect(score.completeness).toBe(0.5);
    expect(score.hiddenScoredModuleCount).toBe(0);
  });

  it("keeps hidden modules in scoring while disabled modules do not affect score or completeness", () => {
    const score = aggregateCandidateScore({
      candidateId: "candidate-1",
      projectId: "project-1",
      configRevision: 3,
      inputHash: "input-1",
      modules: {
        ...modules,
        zodiac: { ...modules.zodiac, analysisEnabled: false },
      },
      evidence: [
        softEvidence({ dimensionId: "sound", deduction: 0 }),
        softEvidence({ dimensionId: "meaning", deduction: 0 }),
        softEvidence({
          moduleId: "bazi_wuxing",
          dimensionId: "useful_god",
          deduction: 20,
        }),
        softEvidence({ moduleId: "zodiac", dimensionId: "radicals", deduction: 100 }),
      ],
    });

    expect(score.moduleScores).toEqual({ basic: 100, bazi_wuxing: 80 });
    expect(score.totalScore).toBeCloseTo((100 * 70 + 80 * 20) / 90, 12);
    expect(score.expectedDimensions).toBe(3);
    expect(score.evaluatedDimensions).toBe(3);
    expect(score.hiddenScoredModuleCount).toBe(1);
  });

  it("removes explicitly not-applicable dimensions from the completeness denominator", () => {
    const score = aggregateCandidateScore({
      candidateId: "candidate-1",
      projectId: "project-1",
      configRevision: 3,
      inputHash: "input-1",
      modules: {
        ...modules,
        bazi_wuxing: disabledModule(),
        zodiac: disabledModule(),
      },
      evidence: [
        softEvidence({ dimensionId: "sound", deduction: 0 }),
        unknownEvidence({ dimensionId: "meaning", applicability: "not_applicable" }),
      ],
    });

    expect(score.expectedDimensions).toBe(1);
    expect(score.evaluatedDimensions).toBe(1);
    expect(score.completeness).toBe(1);
  });

  it("derives hard status independently and always ranks a hard conflict last", () => {
    const pass = scoreWithHardEvidence([hardEvidence({ status: "pass" })]);
    const notice = scoreWithHardEvidence([hardEvidence({ status: "notice" })]);
    const unknown = scoreWithHardEvidence([
      hardEvidence({ status: "unknown", applicability: "missing_input" }),
    ]);
    const conflict = scoreWithHardEvidence([hardEvidence({ status: "conflict" })]);

    expect([
      pass.hardStatus,
      notice.hardStatus,
      unknown.hardStatus,
      conflict.hardStatus,
    ]).toEqual(["pass", "notice", "unknown", "conflict"]);

    const ranked = [
      ranking("conflict", 100, "candidate-conflict"),
      ranking("pass", 1, "candidate-pass"),
      ranking("notice", 100, "candidate-notice"),
      ranking("unknown", 100, "candidate-unknown"),
    ].sort(compareCandidateRanking);
    expect(ranked.map(({ id }) => id)).toEqual([
      "candidate-pass",
      "candidate-notice",
      "candidate-unknown",
      "candidate-conflict",
    ]);
  });

  it("uses unrounded internal precision and deterministic tie breakers", () => {
    const precise = aggregateCandidateScore({
      candidateId: "candidate-1",
      projectId: "project-1",
      configRevision: 3,
      inputHash: "input-1",
      modules: {
        ...modules,
        basic: {
          ...modules.basic,
          dimensionWeights: { first: 1, second: 2 },
        },
        bazi_wuxing: disabledModule(),
        zodiac: disabledModule(),
      },
      evidence: [
        softEvidence({ dimensionId: "first", deduction: 0 }),
        softEvidence({ dimensionId: "second", deduction: 1 }),
      ],
    });
    expect(precise.totalScore).toBeCloseTo(99.33333333333333, 12);
    expect(precise.totalScore).not.toBe(99.3);

    const ranked = [
      { ...ranking("pass", 90, "candidate-b"), createdAt: "2026-01-02T00:00:00.000Z" },
      { ...ranking("pass", 90, "candidate-c"), createdAt: "2026-01-01T00:00:00.000Z" },
      { ...ranking("pass", 90, "candidate-a"), createdAt: "2026-01-01T00:00:00.000Z" },
    ].sort(compareCandidateRanking);
    expect(ranked.map(({ id }) => id)).toEqual(["candidate-a", "candidate-c", "candidate-b"]);
  });
});

function disabledModule(): ScoreModuleConfiguration {
  return { analysisEnabled: false, detailsVisible: false, weight: 0, dimensionWeights: {} };
}

function softEvidence(
  overrides: Partial<RuleEvidence> & Pick<RuleEvidence, "dimensionId">,
): RuleEvidence {
  const deduction = overrides.deduction ?? 0;
  return {
    id: `evidence-${overrides.ruleId ?? overrides.dimensionId}`,
    projectId: "project-1",
    candidateId: "candidate-1",
    moduleId: "basic",
    dimensionId: overrides.dimensionId,
    ruleId: overrides.ruleId ?? `rule-${overrides.dimensionId}`,
    ruleVersion: "1",
    severity: "soft",
    status: deduction > 0 ? "notice" : "pass",
    applicability: "applied",
    scoreBefore: 100,
    deduction,
    scoreAfter: Math.max(0, 100 - deduction),
    explanation: "测试扣分",
    inputSummary: "测试输入",
    inputHash: "input-1",
    calculation: ["100 - 扣分"],
    sourceIds: ["test-source"],
    ...overrides,
  };
}

function unknownEvidence(
  overrides: Partial<RuleEvidence> & Pick<RuleEvidence, "dimensionId">,
): RuleEvidence {
  return {
    id: `unknown-${overrides.dimensionId}`,
    projectId: "project-1",
    candidateId: "candidate-1",
    moduleId: "basic",
    dimensionId: overrides.dimensionId,
    ruleId: `unknown-rule-${overrides.dimensionId}`,
    ruleVersion: "1",
    severity: "soft",
    status: "unknown",
    applicability: "missing_input",
    explanation: "资料不足",
    inputSummary: "测试输入",
    inputHash: "input-1",
    calculation: ["资料不足，退出分母"],
    sourceIds: ["test-source"],
    ...overrides,
  };
}

function hardEvidence(
  overrides: Partial<RuleEvidence> & Pick<RuleEvidence, "status">,
): RuleEvidence {
  return {
    id: `hard-${overrides.status}`,
    projectId: "project-1",
    candidateId: "candidate-1",
    moduleId: "basic",
    dimensionId: "standard",
    ruleId: `hard-rule-${overrides.status}`,
    ruleVersion: "1",
    severity: "hard",
    status: overrides.status,
    applicability: "applied",
    explanation: "硬规则结论",
    inputSummary: "测试输入",
    inputHash: "input-1",
    calculation: ["硬规则不参与分数"],
    sourceIds: ["test-source"],
    ...overrides,
  };
}

function scoreWithHardEvidence(evidence: RuleEvidence[]) {
  return aggregateCandidateScore({
    candidateId: "candidate-1",
    projectId: "project-1",
    configRevision: 3,
    inputHash: "input-1",
    modules: {
      ...modules,
      bazi_wuxing: disabledModule(),
      zodiac: disabledModule(),
    },
    evidence: [
      ...evidence,
      softEvidence({ dimensionId: "sound", deduction: 0 }),
      softEvidence({ dimensionId: "meaning", deduction: 0 }),
    ],
  });
}

function ranking(
  hardStatus: "pass" | "notice" | "unknown" | "conflict",
  totalScore: number,
  id: string,
) {
  return {
    id,
    hardStatus,
    totalScore,
    completeness: 1,
    rating: 0,
    createdAt: "2026-01-01T00:00:00.000Z",
  };
}
