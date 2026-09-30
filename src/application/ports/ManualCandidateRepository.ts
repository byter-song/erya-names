import type { CandidateRuleResult } from "../../domain/rules/types";

export interface ManualCandidateInput {
  id: string;
  projectId: string;
  fullName: string;
  surname: string;
  givenName: string;
  normalizedFingerprint: string;
  summary: string;
  userSource: string;
  pinyin: string[];
  riskSignals: Array<{
    kind:
      "negative_meaning" | "known_homophone" | "multiple_pronunciation" | "input" | "writing";
    outcome: "warn" | "reject";
    explanation: string;
    sourceRefs: string[];
    reviewStatus: "verified";
  }>;
  characterEvidence: Array<{
    char: string;
    pinyin: string[];
    meanings: string[];
    sourceRefs: string[];
  }>;
  createdAt: string;
  ruleResults: CandidateRuleResult[];
}
export interface ManualCandidateRepository {
  exists(projectId: string, normalizedFingerprint: string): Promise<boolean>;
  save(input: ManualCandidateInput): Promise<void>;
}
