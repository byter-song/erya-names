/**
 * Transient evidence emitted while composing a generation batch.
 *
 * This shape is deliberately not a persistence record. The assessment pipeline converts
 * generation evidence into versioned RuleEvidence before it is stored.
 */
export interface CandidateRuleResult {
  evidenceLevel: "L1" | "L2" | "L3" | "L4";
  outcome: "pass" | "warn" | "reject" | "unknown";
  ruleId: string;
  ruleVersion: string;
  explanation: string;
  sourceRefs: string[];
  scoreDelta?: number;
}

export interface RuleEvaluation {
  accepted: boolean;
  results: CandidateRuleResult[];
}
