import type { RuleResult } from "./result";

export type CandidateRuleResult = Omit<RuleResult, "id" | "candidateId">;

export interface RuleEvaluation {
  accepted: boolean;
  results: CandidateRuleResult[];
}
