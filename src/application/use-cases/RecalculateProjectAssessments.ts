import type {
  AssessmentRepository,
  AssessmentWriteError,
  EvidenceReplacement,
} from "../ports/AssessmentRepository";
import type { GenerationRepository } from "../ports/GenerationRepository";
import type { ProjectRepository } from "../ports/ProjectRepository";
import type { Candidate } from "../../domain/candidate/candidate";
import type { CandidateSourceEvidence } from "../../domain/candidate/sourceEvidence";
import type { NamingProfile } from "../../domain/project/profile";
import type { CandidateScore } from "../../domain/rules/candidateScore";
import { err, ok, type Result } from "../../domain/shared/result";

export interface AssessmentScheduler {
  schedule(task: () => void): void;
}

export interface CandidateAssessmentInput {
  candidate: Candidate;
  profile: NamingProfile;
  sources: CandidateSourceEvidence[];
}

export interface CandidateAssessmentOutput {
  replacements: EvidenceReplacement[];
  score: CandidateScore;
}

export type RecalculationError =
  | AssessmentWriteError
  | "assessment-run-cancelled"
  | "assessment-run-failed"
  | "project-not-found";

interface RecalculationOptions {
  batchSize: number;
  scheduler: AssessmentScheduler;
  evaluateCandidate(
    input: CandidateAssessmentInput,
  ): CandidateAssessmentOutput | Promise<CandidateAssessmentOutput>;
}

/**
 * Rebuilds candidate evidence and scores in small, revision-guarded transactions.
 * Progress is absolute, so a replacement run for the same revision can resume from
 * scores that were committed by an interrupted run.
 */
export class RecalculateProjectAssessments {
  private readonly cancelledRuns = new Set<string>();

  constructor(
    private readonly projects: ProjectRepository,
    private readonly generations: GenerationRepository,
    private readonly assessments: AssessmentRepository,
    private readonly options: RecalculationOptions,
  ) {
    if (!Number.isInteger(options.batchSize) || options.batchSize <= 0)
      throw new Error("batchSize must be a positive integer");
  }

  async recalculate(input: {
    projectId: string;
    runId: string;
  }): Promise<Result<void, RecalculationError>> {
    const workspace = await this.projects.getWorkspace(input.projectId);
    if (!workspace) return err("project-not-found");

    const activeRun = await this.assessments.getActiveRun(input.projectId);
    if (!activeRun || activeRun.runId !== input.runId) return err("assessment-run-stale");

    const [rows, currentScores] = await Promise.all([
      this.generations.listCandidates(input.projectId),
      this.assessments.listScores({
        projectId: input.projectId,
        configRevision: workspace.profile.configRevision,
      }),
    ]);
    const completedIds = new Set(currentScores.map(({ candidateId }) => candidateId));
    const remaining = rows.filter(({ candidate }) => !completedIds.has(candidate.id));
    let completed = rows.length - remaining.length;

    if (remaining.length === 0) {
      const completedRun = await this.assessments.completeRun(input);
      return completedRun.ok ? ok(undefined) : completedRun;
    }

    return new Promise((resolve) => {
      let cursor = 0;
      let settled = false;

      const finish = (result: Result<void, RecalculationError>) => {
        if (settled) return;
        settled = true;
        this.cancelledRuns.delete(this.runKey(input));
        resolve(result);
      };

      const processNext = () => {
        void (async () => {
          const runKey = this.runKey(input);
          if (this.cancelledRuns.has(runKey)) {
            finish(err("assessment-run-cancelled"));
            return;
          }

          const currentRun = await this.assessments.getActiveRun(input.projectId);
          if (!currentRun || currentRun.runId !== input.runId) {
            finish(err("assessment-run-stale"));
            return;
          }

          const candidates = remaining.slice(cursor, cursor + this.options.batchSize);
          try {
            const evaluated = await Promise.all(
              candidates.map(({ candidate, sources }) =>
                this.options.evaluateCandidate({
                  candidate,
                  profile: workspace.profile,
                  sources,
                }),
              ),
            );
            completed += candidates.length;
            const write = await this.assessments.replaceCandidateAssessmentBatch({
              projectId: input.projectId,
              runId: input.runId,
              configRevision: workspace.profile.configRevision,
              replacements: evaluated.flatMap(({ replacements }) => replacements),
              scores: evaluated.map(({ score }) => score),
              completed,
            });
            if (!write.ok) {
              finish(err(write.error));
              return;
            }

            cursor += candidates.length;
            if (cursor < remaining.length) {
              this.options.scheduler.schedule(processNext);
              return;
            }

            const completion = await this.assessments.completeRun(input);
            finish(completion.ok ? ok(undefined) : err(completion.error));
          } catch {
            await this.assessments.failRun(input);
            finish(err("assessment-run-failed"));
          }
        })();
      };

      this.options.scheduler.schedule(processNext);
    });
  }

  async cancel(input: { projectId: string; runId: string }): Promise<void> {
    this.cancelledRuns.add(this.runKey(input));
    await this.assessments.cancelRun(input);
  }

  private runKey(input: { projectId: string; runId: string }): string {
    return `${input.projectId}\u0000${input.runId}`;
  }
}

export function createAssessmentScheduler(dependencies: {
  requestIdleCallback?: (callback: () => void) => number;
  setTimeout: (callback: () => void, delay?: number) => number;
}): AssessmentScheduler {
  return {
    schedule(task) {
      if (dependencies.requestIdleCallback) {
        dependencies.requestIdleCallback(task);
        return;
      }
      dependencies.setTimeout(task, 0);
    },
  };
}
