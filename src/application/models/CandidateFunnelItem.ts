import type { ActiveCandidatePool, CandidatePool } from "../../domain/candidate/decision";
import type { CandidateSourceEvidence } from "../../domain/candidate/sourceEvidence";
import type { CandidateScore } from "../../domain/rules/candidateScore";

export interface CandidateFunnelItem {
  id: string;
  batchId?: string | undefined;
  createdAt?: string | undefined;
  givenName?: string | undefined;
  fullName: string;
  pinyin: string[];
  sourceType:
    "verified_allusion" | "modern_combination" | "user_input" | "historical_inspiration";
  summary: string;
  sourceEvidence: CandidateSourceEvidence[];
  pool: CandidatePool;
  lastActivePool?: ActiveCandidatePool;
  exclusionReason?: string;
  excludedAt?: string;
  decisionUpdatedAt: string;
  scoringPending: boolean;
  hardStatus: CandidateScore["hardStatus"];
  totalScore?: number;
  completeness: number;
  moduleScores: CandidateScore["moduleScores"];
  topDeductions: CandidateScore["topDeductions"];
  hiddenScoredModuleCount: number;
  rating?: number;
  note?: string;
}
