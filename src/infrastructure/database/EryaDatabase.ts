import Dexie, { type EntityTable, type Table } from "dexie";
import { V1_STORES } from "./migrations/v1";
import { upgradeToV2, V2_STORES } from "./migrations/v2";
import { upgradeToV3, V3_STORES } from "./migrations/v3";
import type {
  AppMetadataRecord,
  CandidateDecisionRecord,
  CandidateEvaluationRecord,
  CandidateRecord,
  CandidateSourceRecord,
  DecisionHistoryRecord,
  EntityRecord,
  FinalDecisionRecord,
  ProjectRecord,
  RuleResultRecord,
} from "./schema";
import type { NamingProfile } from "../../domain/project/profile";
import type { ComparisonSnapshot } from "../../domain/candidate/comparisonSnapshot";

export const ERYA_DATABASE_NAME = "erya-names";
export const ERYA_DATABASE_VERSION = 3;
export const ERYA_TABLES = Object.freeze(Object.keys(V1_STORES));

export class EryaDatabase extends Dexie {
  projects!: EntityTable<ProjectRecord, "id">;
  profiles!: EntityTable<NamingProfile, "projectId">;
  generationBatches!: EntityTable<EntityRecord, "id">;
  candidates!: EntityTable<CandidateRecord, "id">;
  candidateSources!: EntityTable<CandidateSourceRecord, "id">;
  ruleResults!: EntityTable<RuleResultRecord, "id">;
  candidateDecisions!: EntityTable<CandidateDecisionRecord, "candidateId">;
  decisionHistory!: Table<DecisionHistoryRecord, number>;
  candidateEvaluations!: EntityTable<CandidateEvaluationRecord, "candidateId">;
  comparisonSnapshots!: EntityTable<ComparisonSnapshot, "id">;
  finalDecisions!: EntityTable<FinalDecisionRecord, "projectId">;
  appMetadata!: EntityTable<AppMetadataRecord, "key">;

  constructor(name = ERYA_DATABASE_NAME) {
    super(name);
    this.version(1).stores(V1_STORES);
    this.version(2).stores(V2_STORES).upgrade(upgradeToV2);
    this.version(3).stores(V3_STORES).upgrade(upgradeToV3);
  }
}
