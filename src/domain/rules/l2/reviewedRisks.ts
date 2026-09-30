import type { RuntimeBundle } from "../../../data/schema/runtimeBundle";
import type { ReviewedRiskSignal } from "../../../data/schema/runtimeBundle";
import type { CandidateRuleResult } from "../types";

const RULE_VERSION = "l2-reviewed-risk-1";
const cache = new WeakMap<RuntimeBundle, Map<string, RuntimeBundle["characters"][number]>>();

export function evaluateReviewedRisks(input: {
  givenName: string;
  sourceRiskSignals: ReviewedRiskSignal[];
  bundle: RuntimeBundle;
}): CandidateRuleResult[] {
  let entries = cache.get(input.bundle);
  if (!entries) {
    entries = new Map(input.bundle.characters.map((entry) => [entry.char, entry]));
    cache.set(input.bundle, entries);
  }
  const signals = [...input.sourceRiskSignals];
  for (const char of input.givenName) {
    const entry = entries.get(char);
    signals.push(...(entry?.riskSignals ?? []));
  }

  const uniqueSignals = [
    ...new Map(
      signals.map((signal) => [
        `${signal.kind}:${signal.outcome}:${signal.explanation}`,
        signal,
      ]),
    ).values(),
  ];

  if (uniqueSignals.length === 0) {
    return [
      {
        ruleId: "l2-reviewed-language-risk",
        evidenceLevel: "L2",
        outcome: "pass",
        explanation: "当前已复核风险库未发现明确语言与使用风险",
        sourceRefs: [],
        scoreDelta: 0,
        ruleVersion: RULE_VERSION,
      },
    ];
  }

  const ruleIds: Record<ReviewedRiskSignal["kind"], string> = {
    negative_meaning: "l2-negative-meaning",
    known_homophone: "l2-known-homophone",
    multiple_pronunciation: "l2-multiple-pronunciation",
    input: "l2-input-risk",
    writing: "l2-writing-risk",
  };

  return uniqueSignals.map((signal) => ({
    ruleId: ruleIds[signal.kind],
    evidenceLevel: "L2" as const,
    outcome: signal.outcome,
    explanation: signal.explanation,
    sourceRefs: signal.sourceRefs,
    scoreDelta: 0,
    ruleVersion: RULE_VERSION,
  }));
}
