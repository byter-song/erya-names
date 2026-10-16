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

  it("rejects candidates that do not carry the current persisted base rule", () => {
    expect(() => calculateSystemScore([scoreRule(5)])).toThrow("system-score-base-missing");
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

  it("keeps L4 folklore deltas outside the base system score", () => {
    const folklore = scoreRule(20, {
      evidenceLevel: "L4",
      ruleId: "l4-user-specified-five-elements",
    });

    expect(calculateSystemScore([createSystemScoreBaseRule(), scoreRule(5), folklore])).toBe(
      65,
    );
    expect(getSystemScoreEvidence([createSystemScoreBaseRule(), folklore])).not.toContainEqual(
      expect.objectContaining({ evidenceLevel: "L4" }),
    );
  });
});
