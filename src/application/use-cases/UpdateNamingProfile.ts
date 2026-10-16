import type { GenerationRepository } from "../ports/GenerationRepository";
import type { ProjectRepository, ProjectWorkspace } from "../ports/ProjectRepository";
import { namingProfileSchema, type NamingProfile } from "../../domain/project/profile";
import { namingProjectSchema } from "../../domain/project/project";
import { assessmentRunSchema } from "../../domain/rules/assessmentRun";
import { err, ok, type Result } from "../../domain/shared/result";
import { ZodError } from "../../domain/shared/zod";

type ProfilePatch = Partial<Omit<NamingProfile, "projectId" | "configRevision">>;

export interface UpdateNamingProfileResult {
  workspace: ProjectWorkspace;
  runId?: string;
}

/** Saves only the v2 nested profile shape and creates a revision-bound assessment run when needed. */
export class UpdateNamingProfile {
  constructor(
    private readonly projects: ProjectRepository,
    private readonly generations: GenerationRepository,
    private readonly dependencies: { now: () => string; createRunId: () => string },
  ) {}

  async execute(input: {
    projectId: string;
    expectedRevision: number;
    patch: ProfilePatch;
    completeOnboarding: boolean;
  }): Promise<Result<UpdateNamingProfileResult, string>> {
    const current = await this.projects.getWorkspace(input.projectId);
    if (!current) return err("project-not-found");

    try {
      const draftProfile = namingProfileSchema.parse({
        ...current.profile,
        ...input.patch,
        projectId: input.projectId,
        configRevision: input.expectedRevision,
      });
      const scoringInputsChanged = !haveSameScoringInputs(current.profile, draftProfile);
      const profile = namingProfileSchema.parse({
        ...draftProfile,
        configRevision: input.expectedRevision + (scoringInputsChanged ? 1 : 0),
      });
      const now = this.dependencies.now();
      const project = namingProjectSchema.parse({
        ...current.project,
        stage: input.completeOnboarding ? "naming" : current.project.stage,
        status: input.completeOnboarding ? "active" : current.project.status,
        updatedAt: now,
      });
      const workspace = { project, profile };

      if (!scoringInputsChanged) {
        const saved = await this.projects.saveConfiguration({
          projectId: input.projectId,
          expectedRevision: input.expectedRevision,
          write: { kind: "display-only", workspace },
        });
        return saved.ok ? ok({ workspace: saved.value.workspace }) : err(saved.error);
      }

      const runId = this.dependencies.createRunId();
      const assessmentRun = assessmentRunSchema.parse({
        projectId: input.projectId,
        runId,
        configRevision: profile.configRevision,
        status: "running",
        completed: 0,
        total: (await this.generations.listCandidates(input.projectId)).length,
      });
      const saved = await this.projects.saveConfiguration({
        projectId: input.projectId,
        expectedRevision: input.expectedRevision,
        write: { kind: "scoring-inputs-changed", workspace, assessmentRun },
      });
      return saved.ok ? ok({ workspace: saved.value.workspace, runId }) : err(saved.error);
    } catch (error) {
      return err(
        error instanceof ZodError
          ? error.issues.map((issue) => issue.message).join("；")
          : error instanceof Error
            ? error.message
            : "Unable to update profile",
      );
    }
  }
}

function haveSameScoringInputs(current: NamingProfile, next: NamingProfile): boolean {
  return JSON.stringify(scoringInputs(current)) === JSON.stringify(scoringInputs(next));
}

function scoringInputs(profile: NamingProfile) {
  return {
    basics: profile.basics,
    family: profile.family,
    inspiration: profile.inspiration,
    calendar: profile.calendar,
    modules: Object.fromEntries(
      Object.entries(profile.modules).map(
        ([moduleId, { analysisEnabled, weight, schoolId, ruleVersion }]) => [
          moduleId,
          { analysisEnabled, weight, schoolId, ruleVersion },
        ],
      ),
    ),
    scoring: profile.scoring,
    usefulGodDecision: profile.usefulGodDecision,
  };
}
