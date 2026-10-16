import type { GenerationRepository } from "../ports/GenerationRepository";
import type { ProjectRepository, ProjectWorkspace } from "../ports/ProjectRepository";
import {
  namingProfileSchema,
  type FolkloreModuleId,
  type NamingProfile,
  type NamingProfileDraft,
} from "../../domain/project/profile";
import { scoringInputHash } from "../../domain/project/scoringInputHash";
import { namingProjectSchema } from "../../domain/project/project";
import { assessmentRunSchema } from "../../domain/rules/assessmentRun";
import { err, ok, type Result } from "../../domain/shared/result";
import { ZodError } from "../../domain/shared/zod";

export interface ConfigurationImpactSummary {
  changedSections: string[];
  recalculationRequired: boolean;
  affectedCandidateCount: number;
  missingInputs: string[];
}

export interface SaveNamingConfigurationResult {
  profile: NamingProfile;
  impact: ConfigurationImpactSummary;
  runId?: string;
}

type SaveInput = Readonly<{
  projectId: string;
  expectedRevision: number;
  configuration: NamingProfileDraft;
}>;

/** Owns the single configuration-save path and creates a revision-bound assessment run. */
export class SaveNamingConfiguration {
  constructor(
    private readonly projects: ProjectRepository,
    private readonly generations: GenerationRepository,
    private readonly dependencies: {
      now: () => string;
      createRunId: () => string;
      onRecalculationRequested?: (input: {
        projectId: string;
        runId: string;
      }) => void | Promise<void>;
    },
  ) {}

  async preview(input: SaveInput): Promise<Result<ConfigurationImpactSummary, string>> {
    const prepared = await this.prepare(input);
    return prepared.ok ? ok(prepared.value.impact) : prepared;
  }

  async execute(input: SaveInput): Promise<Result<SaveNamingConfigurationResult, string>> {
    const prepared = await this.prepare(input);
    if (!prepared.ok) return prepared;

    const { current, profile, impact } = prepared.value;
    const now = this.dependencies.now();
    const workspace: ProjectWorkspace = {
      project: namingProjectSchema.parse({ ...current.project, updatedAt: now }),
      profile,
    };

    if (!impact.recalculationRequired) {
      const saved = await this.projects.saveConfiguration({
        projectId: input.projectId,
        expectedRevision: input.expectedRevision,
        write: { kind: "display-only", workspace },
      });
      return saved.ok
        ? ok({ profile: saved.value.workspace.profile, impact })
        : err(saved.error);
    }

    const runId = this.dependencies.createRunId();
    const assessmentRun = assessmentRunSchema.parse({
      projectId: input.projectId,
      runId,
      configRevision: profile.configRevision,
      status: "running",
      completed: 0,
      total: impact.affectedCandidateCount,
    });
    const saved = await this.projects.saveConfiguration({
      projectId: input.projectId,
      expectedRevision: input.expectedRevision,
      write: { kind: "scoring-inputs-changed", workspace, assessmentRun },
    });
    if (!saved.ok) return err(saved.error);

    await this.dependencies.onRecalculationRequested?.({ projectId: input.projectId, runId });
    return ok({ profile: saved.value.workspace.profile, impact, runId });
  }

  private async prepare(input: SaveInput): Promise<
    Result<
      {
        current: ProjectWorkspace;
        profile: NamingProfile;
        impact: ConfigurationImpactSummary;
      },
      string
    >
  > {
    const current = await this.projects.getWorkspace(input.projectId);
    if (!current) return err("project-not-found");
    if (current.profile.configRevision !== input.expectedRevision)
      return err("configuration-stale");

    try {
      const draft = namingProfileSchema.parse({
        ...input.configuration,
        projectId: input.projectId,
        configRevision: input.expectedRevision,
      });
      const recalculationRequired =
        (await scoringInputHash(current.profile)) !== (await scoringInputHash(draft));
      const candidateCount = recalculationRequired
        ? (await this.generations.listCandidates(input.projectId)).length
        : 0;
      const profile = namingProfileSchema.parse({
        ...draft,
        configRevision: input.expectedRevision + (recalculationRequired ? 1 : 0),
      });
      return ok({
        current,
        profile,
        impact: {
          changedSections: changedSections(current.profile, draft),
          recalculationRequired,
          affectedCandidateCount: candidateCount,
          missingInputs: missingInputs(draft),
        },
      });
    } catch (error) {
      return err(
        error instanceof ZodError
          ? error.issues.map(({ message }) => message).join("；")
          : error instanceof Error
            ? error.message
            : "invalid-configuration",
      );
    }
  }
}

function changedSections(current: NamingProfile, next: NamingProfile): string[] {
  const changed: string[] = [];
  for (const section of ["basics", "family", "inspiration", "calendar"] as const)
    if (!same(current[section], next[section])) changed.push(section);
  for (const moduleId of Object.keys(current.modules) as FolkloreModuleId[])
    if (!same(current.modules[moduleId], next.modules[moduleId])) changed.push(moduleId);
  if (!same(current.scoring, next.scoring)) changed.push("scoring");
  if (!same(current.usefulGodDecision, next.usefulGodDecision))
    changed.push("usefulGodDecision");
  return changed;
}

function missingInputs(profile: NamingProfile): string[] {
  if (
    (profile.modules.bazi_wuxing.analysisEnabled || profile.modules.zodiac.analysisEnabled) &&
    !profile.calendar.birthLocalDateTime
  )
    return ["calendar.birthLocalDateTime"];
  return [];
}

function same(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}
