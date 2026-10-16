import Dexie, { type EntityTable, type Table } from "dexie";
import type {
  AppMetadataRecord,
  AssessmentRunRecord,
  CandidateDecisionRecord,
  CandidateEvaluationRecord,
  CandidateRecord,
  CandidateScoreRecord,
  CandidateSourceRecord,
  DecisionHistoryRecord,
  GenerationBatchRecord,
  NamingProfileRecord,
  ProjectAssessmentRecord,
  ProjectRecord,
  RuleEvidenceRecord,
} from "./schema";

export const ERYA_DATABASE_NAME = "erya-names-v2";
export const ERYA_DATABASE_VERSION = 1;

const ERYA_V2_STORES = Object.freeze({
  projects: "&id, status, updatedAt",
  profiles: "&projectId",
  generationBatches: "&id, projectId, createdAt",
  candidates: "&id, projectId, &[projectId+normalizedFingerprint], sourceType, createdAt",
  candidateSources: "&id, projectId, candidateId, sourceId",
  candidateDecisions: "&candidateId, [projectId+pool], projectId, updatedAt",
  decisionHistory: "++id, projectId, candidateId, changedAt",
  candidateEvaluations: "&candidateId, projectId",
  projectAssessments: "&id, &[projectId+moduleId], projectId, inputHash",
  ruleEvidence: "&id, [projectId+candidateId], [candidateId+moduleId], projectId, inputHash",
  candidateScores: "&candidateId, projectId, configRevision, totalScore",
  assessmentRuns: "&projectId, runId, status",
  appMetadata: "&key",
});

export const ERYA_TABLES = Object.freeze(Object.keys(ERYA_V2_STORES));

export class EryaDatabase extends Dexie {
  projects!: EntityTable<ProjectRecord, "id">;
  profiles!: EntityTable<NamingProfileRecord, "projectId">;
  generationBatches!: EntityTable<GenerationBatchRecord, "id">;
  candidates!: EntityTable<CandidateRecord, "id">;
  candidateSources!: EntityTable<CandidateSourceRecord, "id">;
  candidateDecisions!: EntityTable<CandidateDecisionRecord, "candidateId">;
  decisionHistory!: Table<DecisionHistoryRecord, number>;
  candidateEvaluations!: EntityTable<CandidateEvaluationRecord, "candidateId">;
  projectAssessments!: EntityTable<ProjectAssessmentRecord, "id">;
  ruleEvidence!: EntityTable<RuleEvidenceRecord, "id">;
  candidateScores!: EntityTable<CandidateScoreRecord, "candidateId">;
  assessmentRuns!: EntityTable<AssessmentRunRecord, "projectId">;
  appMetadata!: EntityTable<AppMetadataRecord, "key">;

  constructor(name = ERYA_DATABASE_NAME) {
    super(name);
    this.version(ERYA_DATABASE_VERSION).stores(ERYA_V2_STORES);
  }
}
