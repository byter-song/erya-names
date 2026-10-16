import type { AssessmentRepository } from "../ports/AssessmentRepository";
import type { GenerationRepository } from "../ports/GenerationRepository";
import type { ProjectRepository } from "../ports/ProjectRepository";
import { assessmentRunSchema } from "../../domain/rules/assessmentRun";
import type { AssessNamingProject } from "./AssessNamingProject";
import type { RecalculateProjectAssessments } from "./RecalculateProjectAssessments";

export type ProjectAnalysisOutcome =
  { status: "completed"; runId: string } | { status: "failed"; runId?: string; error: string };

/**
 * Starts a fresh, revision-bound run for every currently persisted candidate and
 * completes both project folklore and candidate assessment before returning.
 * A failed run remains persisted so the UI can offer an explicit retry.
 */
export class AnalyzeCurrentProjectCandidates {
  constructor(
    private readonly projects: ProjectRepository,
    private readonly generations: GenerationRepository,
    private readonly assessments: AssessmentRepository,
    private readonly assessNamingProject: Pick<AssessNamingProject, "execute">,
    private readonly recalculateProjectAssessments: Pick<
      RecalculateProjectAssessments,
      "recalculate"
    >,
    private readonly dependencies: { createRunId: () => string },
  ) {}

  async execute(input: { projectId: string }): Promise<ProjectAnalysisOutcome> {
    const workspace = await this.projects.getWorkspace(input.projectId);
    if (!workspace) return { status: "failed", error: "project-not-found" };

    const [rows, scores] = await Promise.all([
      this.generations.listCandidates(input.projectId),
      this.assessments.listScores({
        projectId: input.projectId,
        configRevision: workspace.profile.configRevision,
      }),
    ]);
    const candidateIds = new Set(rows.map(({ candidate }) => candidate.id));
    const completed = scores.filter(({ candidateId }) => candidateIds.has(candidateId)).length;
    const runId = this.dependencies.createRunId();
    const run = assessmentRunSchema.parse({
      projectId: input.projectId,
      runId,
      configRevision: workspace.profile.configRevision,
      status: "running",
      completed,
      total: rows.length,
    });
    const started = await this.assessments.startRun(run);
    if (!started.ok) return { status: "failed", error: started.error };

    return this.continueRun({ projectId: input.projectId, runId });
  }

  async continueRun(input: {
    projectId: string;
    runId: string;
  }): Promise<ProjectAnalysisOutcome> {
    try {
      const projectResult = await this.assessNamingProject.execute(input);
      if (!projectResult.ok) return await this.fail(input, projectResult.error);

      const candidateResult = await this.recalculateProjectAssessments.recalculate(input);
      if (!candidateResult.ok) return await this.fail(input, candidateResult.error);
      return { status: "completed", runId: input.runId };
    } catch (error) {
      return this.fail(input, error instanceof Error ? error.message : "assessment-run-failed");
    }
  }

  private async fail(
    input: { projectId: string; runId: string },
    error: string,
  ): Promise<ProjectAnalysisOutcome> {
    await this.assessments.failRun(input);
    return { status: "failed", runId: input.runId, error };
  }
}
