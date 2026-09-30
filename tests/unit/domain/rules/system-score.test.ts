import { describe, expect, it } from "vitest";
import { evaluateFullNameSound } from "../../../../src/domain/rules/l2/fullNameSound";
import {
  calculateSystemScore,
  createSystemScoreBaseRule,
  getSystemScoreEvidence,
} from "../../../../src/domain/rules/scoring/systemScore";
import type { CandidateRuleResult } from "../../../../src/domain/rules/types";

function scoreRule(
  scoreDelta: number,
  overrides: Partial<CandidateRuleResult> = {},
): CandidateRuleResult {
  return {
    evidenceLevel: "L3",
    outcome: "pass",
    ruleId: `test-score-${scoreDelta}`,
    ruleVersion: "test-1",
    explanation: "测试评分证据",
    sourceRefs: [],
    scoreDelta,
    ...overrides,
  };
}

describe("system match score", () => {
  it("starts from a persisted 60-point base and applies every explicit delta", () => {
    const rules = [createSystemScoreBaseRule(), scoreRule(12), scoreRule(-8), scoreRule(50)];

    expect(calculateSystemScore(rules)).toBe(100);
    expect(getSystemScoreEvidence(rules).map((rule) => rule.scoreDelta)).toEqual([
      60, 12, -8, 50,
    ]);
  });

  it("clamps the aggregate to the 0-100 range", () => {
    expect(calculateSystemScore([createSystemScoreBaseRule(), scoreRule(-100)])).toBe(0);
    expect(calculateSystemScore([createSystemScoreBaseRule(), scoreRule(100)])).toBe(100);
  });

  it("uses a compatibility base and applies legacy full-name-1 only once", () => {
    const legacyWarning = scoreRule(0, {
      evidenceLevel: "L2",
      outcome: "warn",
      ruleId: "l2-full-name-homophone",
      ruleVersion: "full-name-1",
    });
    const evidence = getSystemScoreEvidence([legacyWarning, legacyWarning]);

    expect(calculateSystemScore([legacyWarning, legacyWarning])).toBe(52);
    expect(evidence.filter((rule) => rule.ruleId === "l2-full-name-homophone")).toEqual([
      expect.objectContaining({ scoreDelta: -8 }),
    ]);
    expect(evidence[0]).toMatchObject({ ruleId: "l3-score-base", scoreDelta: 60 });
  });

  it("stores a visible negative delta for newly detected full-name homophones", () => {
    expect(evaluateFullNameSound("吴", ["lǐ"])).toEqual([
      expect.objectContaining({
        ruleId: "l2-full-name-homophone",
        ruleVersion: "full-name-2",
        outcome: "warn",
        scoreDelta: -8,
      }),
    ]);
  });
});
