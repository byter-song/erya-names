import type { CandidateRuleResult } from "../types";

export const SYSTEM_SCORE_BASE = 60;
export const SYSTEM_SCORE_MIN = 0;
export const SYSTEM_SCORE_MAX = 100;
export const SYSTEM_SCORE_BASE_RULE_ID = "l3-score-base";

export function createSystemScoreBaseRule(): CandidateRuleResult {
  return {
    evidenceLevel: "L3",
    outcome: "pass",
    ruleId: SYSTEM_SCORE_BASE_RULE_ID,
    ruleVersion: "system-score-1",
    explanation: "系统匹配分以 60 分为基准，再按当前方案的明确匹配项与风险项增减。",
    sourceRefs: [],
    scoreDelta: SYSTEM_SCORE_BASE,
  };
}

export function getSystemScoreEvidence(
  ruleResults: readonly CandidateRuleResult[],
): CandidateRuleResult[] {
  const evidence: CandidateRuleResult[] = [];
  let hasBaseRule = false;

  for (const rule of ruleResults) {
    if (rule.evidenceLevel === "L4") continue;

    if (rule.ruleId === SYSTEM_SCORE_BASE_RULE_ID) {
      if (hasBaseRule) continue;
      hasBaseRule = true;
    }

    const scoreDelta = rule.scoreDelta ?? 0;
    if (
      rule.ruleId !== SYSTEM_SCORE_BASE_RULE_ID &&
      rule.evidenceLevel !== "L3" &&
      scoreDelta === 0
    )
      continue;

    evidence.push({ ...rule, scoreDelta });
  }

  if (!hasBaseRule) throw new Error("system-score-base-missing");
  return evidence;
}

export function calculateSystemScore(ruleResults: readonly CandidateRuleResult[]): number {
  const total = getSystemScoreEvidence(ruleResults).reduce(
    (sum, rule) => sum + (rule.scoreDelta ?? 0),
    0,
  );
  return Math.min(SYSTEM_SCORE_MAX, Math.max(SYSTEM_SCORE_MIN, Math.round(total)));
}
