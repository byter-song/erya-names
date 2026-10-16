import type { RuleEvidence } from "../../domain/rules/result";
import type { CandidateFunnelItem } from "./CandidateFunnelItem";

export interface CandidateDetail {
  candidate: CandidateFunnelItem;
  evidence: RuleEvidence[];
  hiddenEvidenceCount: number;
}
