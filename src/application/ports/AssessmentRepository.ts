import type { ProjectAssessment } from "../../domain/folklore/projectAssessment";
import type { AssessmentRun } from "../../domain/rules/assessmentRun";
import type { CandidateScore } from "../../domain/rules/candidateScore";
import type { RuleEvidence, RuleModuleId } from "../../domain/rules/result";
import type { Result } from "../../domain/shared/result";

export type { ProjectAssessment } from "../../domain/folklore/projectAssessment";

export interface EvidenceReplacement {
  candidateId: string;
  moduleId: RuleModuleId;
  inputHash: string;
  evidence: RuleEvidence[];
}

export type AssessmentWriteError =
  "assessment-run-stale" | "assessment-revision-mismatch" | "assessment-input-mismatch";

/**
 * Owns assessment cache transactions. Every replacement verifies the active run and revision.
 * Evidence is replaced idempotently by (candidateId, moduleId, inputHash); evidence, scores, and
 * run progress commit together so a stale run cannot partially overwrite current results.
 */
export interface AssessmentRepository {
  /** Returns the latest persisted run, including terminal states, for progress presentation. */
  getRun(projectId: string): Promise<AssessmentRun | undefined>;
  /** Returns the project's run only while it is the current running revision. */
  getActiveRun(projectId: string): Promise<AssessmentRun | undefined>;
  /** Starts or replaces the project run for the current profile revision. */
  startRun(run: AssessmentRun): Promise<Result<AssessmentRun, AssessmentWriteError>>;
  cancelRun(input: {
    projectId: string;
    runId: string;
  }): Promise<Result<void, AssessmentWriteError>>;
  failRun(input: {
    projectId: string;
    runId: string;
  }): Promise<Result<AssessmentRun, AssessmentWriteError>>;
  /** Replaces each (projectId, moduleId) cache only while the supplied run remains active. */
  replaceProjectAssessments(input: {
    projectId: string;
    runId: string;
    configRevision: number;
    assessments: ProjectAssessment[];
  }): Promise<Result<void, AssessmentWriteError>>;
  listProjectAssessments(input: {
    projectId: string;
    configRevision: number;
  }): Promise<ProjectAssessment[]>;
  replaceCandidateAssessmentBatch(input: {
    projectId: string;
    runId: string;
    configRevision: number;
    replacements: EvidenceReplacement[];
    scores: CandidateScore[];
    completed: number;
  }): Promise<Result<AssessmentRun, AssessmentWriteError>>;
  completeRun(input: {
    projectId: string;
    runId: string;
  }): Promise<Result<AssessmentRun, AssessmentWriteError>>;
  listEvidence(input: {
    projectId: string;
    candidateId: string;
    inputHash: string;
  }): Promise<RuleEvidence[]>;
  getScore(input: {
    projectId: string;
    candidateId: string;
    configRevision: number;
  }): Promise<CandidateScore | undefined>;
  listScores(input: { projectId: string; configRevision: number }): Promise<CandidateScore[]>;
}
