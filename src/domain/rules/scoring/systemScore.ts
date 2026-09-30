import type { CandidateRuleResult } from "../types";

export const SYSTEM_SCORE_BASE = 60;
export const SYSTEM_SCORE_MIN = 0;
export const SYSTEM_SCORE_MAX = 100;
export const SYSTEM_SCORE_BASE_RULE_ID = "l3-score-base";

const FULL_NAME_HOMOPHONE_RULE_ID = "l2-full-name-homophone";
const LEGACY_FULL_NAME_SOUND_VERSION = "full-name-1";
const LEGACY_FULL_NAME_SOUND_DELTA = -8;

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
  let hasFullNameHomophoneRule = false;

  for (const rule of ruleResults) {
    if (rule.ruleId === SYSTEM_SCORE_BASE_RULE_ID) {
      if (hasBaseRule) continue;
      hasBaseRule = true;
    }

    if (rule.ruleId === FULL_NAME_HOMOPHONE_RULE_ID) {
      if (hasFullNameHomophoneRule) continue;
      hasFullNameHomophoneRule = true;
    }

    const scoreDelta = effectiveScoreDelta(rule);
    if (
      rule.ruleId !== SYSTEM_SCORE_BASE_RULE_ID &&
      rule.evidenceLevel !== "L3" &&
      rule.evidenceLevel !== "L4" &&
      scoreDelta === 0
    )
      continue;

    evidence.push({ ...rule, scoreDelta });
  }

  // Candidates created before system-score-1 have no persisted base rule. Keep their
  // display and ordering compatible without rewriting IndexedDB or backup payloads.
  if (!hasBaseRule) evidence.unshift(createSystemScoreBaseRule());
  return evidence;
}

export function calculateSystemScore(ruleResults: readonly CandidateRuleResult[]): number {
  const total = getSystemScoreEvidence(ruleResults).reduce(
    (sum, rule) => sum + (rule.scoreDelta ?? 0),
    0,
  );
  return Math.min(SYSTEM_SCORE_MAX, Math.max(SYSTEM_SCORE_MIN, Math.round(total)));
}

function effectiveScoreDelta(rule: CandidateRuleResult): number {
  if (
    rule.ruleId === FULL_NAME_HOMOPHONE_RULE_ID &&
    rule.ruleVersion === LEGACY_FULL_NAME_SOUND_VERSION
  )
    return LEGACY_FULL_NAME_SOUND_DELTA;
  return rule.scoreDelta ?? 0;
}
