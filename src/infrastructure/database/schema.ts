import type { ActiveCandidateStage, CandidateStage } from "../../domain/candidate/decision";

export interface ProjectRecord {
  id: string;
  title: string;
  stage: "onboarding" | "generation" | "funnel" | "comparison" | "finalization";
  status: "draft" | "active" | "archived" | "completed";
  updatedAt: string;
}

export interface ProjectOwnedRecord {
  projectId: string;
}

export interface EntityRecord extends ProjectOwnedRecord {
  id: string;
}

export interface CandidateRecord extends EntityRecord {
  batchId: string | null;
  normalizedFingerprint: string;
  surname: string;
  givenName: string;
  fullName: string;
  pinyin: string[];
  sourceType: "verified_allusion" | "modern_combination" | "user_input";
  summary: string;
  sourceIds: string[];
  sourceEvidence: Array<{
    sourceId: string;
    title?: string | undefined;
    work?: string | undefined;
    quote?: string | undefined;
    location?: string | undefined;
    excerpt?: string | undefined;
    url?: string | undefined;
    revision?: string | undefined;
  }>;
  warnings: string[];
  riskSignals: Array<{
    kind:
      "negative_meaning" | "known_homophone" | "multiple_pronunciation" | "input" | "writing";
    outcome: "warn" | "reject";
    explanation: string;
    sourceRefs: string[];
    reviewStatus: "verified";
  }>;
  ruleResults: Array<{
    evidenceLevel: "L1" | "L2" | "L3" | "L4";
    outcome: "pass" | "warn" | "reject" | "unknown";
    ruleId: string;
    ruleVersion: string;
    explanation: string;
    sourceRefs: string[];
    scoreDelta?: number | undefined;
  }>;
  styleTags: string[];
  characterElements: Array<"wood" | "fire" | "earth" | "metal" | "water">;
  characterEvidence?: Array<{
    char: string;
    pinyin: string[];
    meanings: string[];
    sourceRefs: string[];
  }>;
  createdAt: string;
}

export interface CandidateSourceRecord extends EntityRecord {
  candidateId: string;
  sourceId: string;
  title?: string;
  work?: string;
  quote?: string;
  location?: string;
  excerpt?: string;
  url?: string;
  revision?: string;
}

export interface RuleResultRecord extends ProjectOwnedRecord {
  id: string;
  candidateId: string;
  evidenceLevel: "L1" | "L2" | "L3" | "L4";
  outcome: "pass" | "warn" | "reject" | "unknown";
  ruleId: string;
  ruleVersion: string;
  explanation: string;
  sourceRefs: string[];
  scoreDelta?: number;
}

export interface CandidateDecisionRecord extends ProjectOwnedRecord {
  candidateId: string;
  stage: CandidateStage;
  rejectionReason?: string | undefined;
  lastActiveStage?: ActiveCandidateStage | undefined;
  folkloreReviewed?: boolean | undefined;
  updatedAt: string;
}

export interface DecisionHistoryRecord extends ProjectOwnedRecord {
  id?: number;
  candidateId: string;
  from: CandidateDecisionRecord["stage"];
  to: CandidateDecisionRecord["stage"];
  action?: "manual" | "auto_filter_confirmed" | undefined;
  batchId?: string | undefined;
  changedAt: string;
}

export interface CandidateEvaluationRecord extends ProjectOwnedRecord {
  candidateId: string;
  rating?: 1 | 2 | 3 | 4 | 5;
  note?: string;
  updatedAt: string;
}

export interface FinalDecisionRecord extends ProjectOwnedRecord {
  selectedCandidateId: string;
  rationale: string;
  updatedAt: string;
}

export interface AppMetadataRecord {
  key: string;
  value: unknown;
}
