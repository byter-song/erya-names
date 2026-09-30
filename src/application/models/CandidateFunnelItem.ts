export interface CandidateWarningEvidence {
  ruleId: string;
  ruleVersion: string;
  explanation: string;
  sourceRefs: string[];
}

export interface CandidateScoreEvidence {
  ruleId: string;
  outcome: "pass" | "warn" | "reject" | "unknown";
  explanation: string;
  scoreDelta: number;
}

export interface CandidateRuleEvidence {
  evidenceLevel: "L1" | "L2" | "L3" | "L4";
  outcome: "pass" | "warn" | "reject" | "unknown";
  ruleId: string;
  ruleVersion: string;
  explanation: string;
  sourceRefs: string[];
  scoreDelta?: number | undefined;
}

export interface CandidateFunnelItem {
  id: string;
  batchId?: string | undefined;
  givenName?: string | undefined;
  fullName: string;
  pinyin: string[];
  sourceType: "verified_allusion" | "modern_combination" | "user_input";
  summary: string;
  styleTags?: string[] | undefined;
  characterEvidence?: Array<{
    char: string;
    pinyin: string[];
    meanings: string[];
    sourceRefs: string[];
  }>;
  sourceEvidence?: Array<{
    sourceId: string;
    title?: string | undefined;
    work?: string | undefined;
    quote?: string | undefined;
    location?: string | undefined;
    excerpt?: string | undefined;
  }>;
  stage: "inbox" | "favorite" | "comparison" | "finalist" | "rejected";
  rejectionReason?: string | undefined;
  warnings: CandidateWarningEvidence[];
  systemScore?: number;
  scoreEvidence?: CandidateScoreEvidence[];
  ruleEvidence?: CandidateRuleEvidence[];
  rating?: number;
  note?: string;
}
