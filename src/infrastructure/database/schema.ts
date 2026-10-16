import type { Candidate } from "../../domain/candidate/candidate";
import type { CandidateDecision, CandidatePool } from "../../domain/candidate/decision";
import type { CandidateEvaluation } from "../../domain/candidate/evaluation";
import type { GenerationBatch } from "../../domain/generation/batch";
import type { NamingProfile } from "../../domain/project/profile";
import type { NamingProject } from "../../domain/project/project";
import type { AssessmentRun } from "../../domain/rules/assessmentRun";
import type { CandidateScore } from "../../domain/rules/candidateScore";
import type { RuleEvidence } from "../../domain/rules/result";

export type ProjectRecord = NamingProject;
export type NamingProfileRecord = NamingProfile;
export type GenerationBatchRecord = GenerationBatch;
export type CandidateRecord = Candidate;
export type CandidateDecisionRecord = CandidateDecision;
export type CandidateEvaluationRecord = CandidateEvaluation;
export type RuleEvidenceRecord = RuleEvidence;
export type CandidateScoreRecord = CandidateScore;
export type AssessmentRunRecord = AssessmentRun;

export interface CandidateSourceRecord {
  id: string;
  projectId: string;
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

export interface DecisionHistoryRecord {
  id?: number;
  projectId: string;
  candidateId: string;
  from: CandidatePool;
  to: CandidatePool;
  action: "forward" | "backward" | "exclude" | "restore";
  exclusionReason?: string;
  changedAt: string;
}

export interface ProjectAssessmentRecord {
  id: string;
  projectId: string;
  moduleId: keyof NamingProfile["modules"];
  configRevision: number;
  inputHash: string;
  result: Readonly<Record<string, unknown>>;
}

export interface AppMetadataRecord {
  key: string;
  value: unknown;
}
