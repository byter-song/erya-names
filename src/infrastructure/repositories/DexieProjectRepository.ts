import type {
  ConfigurationWrite,
  ProjectWriteError,
  ProjectRepository,
  ProjectWorkspace,
} from "../../application/ports/ProjectRepository";
import { namingProfileSchema, type NamingProfile } from "../../domain/project/profile";
import { namingProjectSchema, type NamingProject } from "../../domain/project/project";
import { assessmentRunSchema } from "../../domain/rules/assessmentRun";
import { err, ok, type Result } from "../../domain/shared/result";
import type { EryaDatabase } from "../database/EryaDatabase";

export class DexieProjectRepository implements ProjectRepository {
  constructor(private readonly database: EryaDatabase) {}

  async create(workspace: ProjectWorkspace): Promise<Result<void, ProjectWriteError>> {
    const parsed = parseWorkspace(workspace);
    if (!parsed || parsed.project.id !== parsed.profile.projectId)
      return err("invalid-project-write");

    return this.database.transaction(
      "rw",
      [this.database.projects, this.database.profiles],
      async () => {
        if (
          (await this.database.projects.get(parsed.project.id)) ||
          (await this.database.profiles.get(parsed.project.id))
        )
          return err("project-id-conflict");
        await this.database.projects.add(parsed.project);
        await this.database.profiles.add(parsed.profile);
        return ok(undefined);
      },
    );
  }

  async deleteProject(projectId: string): Promise<Result<void, ProjectWriteError>> {
    return this.database.transaction(
      "rw",
      [
        this.database.projects,
        this.database.profiles,
        this.database.generationBatches,
        this.database.candidates,
        this.database.candidateSources,
        this.database.candidateDecisions,
        this.database.decisionHistory,
        this.database.candidateEvaluations,
        this.database.projectAssessments,
        this.database.ruleEvidence,
        this.database.candidateScores,
        this.database.assessmentRuns,
      ],
      async () => {
        if (!(await this.database.projects.get(projectId))) return err("project-not-found");
        await Promise.all([
          this.database.projects.delete(projectId),
          this.database.profiles.delete(projectId),
          this.database.generationBatches.where("projectId").equals(projectId).delete(),
          this.database.candidates.where("projectId").equals(projectId).delete(),
          this.database.candidateSources.where("projectId").equals(projectId).delete(),
          this.database.candidateDecisions.where("projectId").equals(projectId).delete(),
          this.database.decisionHistory.where("projectId").equals(projectId).delete(),
          this.database.candidateEvaluations.where("projectId").equals(projectId).delete(),
          this.database.projectAssessments.where("projectId").equals(projectId).delete(),
          this.database.ruleEvidence.where("projectId").equals(projectId).delete(),
          this.database.candidateScores.where("projectId").equals(projectId).delete(),
          this.database.assessmentRuns.delete(projectId),
        ]);
        return ok(undefined);
      },
    );
  }

  async listProjects(): Promise<NamingProject[]> {
    return this.database.projects.orderBy("updatedAt").reverse().toArray();
  }

  async getWorkspace(projectId: string): Promise<ProjectWorkspace | undefined> {
    const [project, profile] = await Promise.all([
      this.database.projects.get(projectId),
      this.database.profiles.get(projectId),
    ]);

    if (!project || !profile) {
      return undefined;
    }

    return {
      project,
      profile,
    };
  }

  async rename(
    input: Parameters<ProjectRepository["rename"]>[0],
  ): Promise<Result<NamingProject, ProjectWriteError>> {
    return this.database.transaction("rw", this.database.projects, async () => {
      const current = await this.database.projects.get(input.projectId);
      if (!current) return err("project-not-found");
      if (current.updatedAt !== input.expectedUpdatedAt) return err("project-stale");
      const parsed = namingProjectSchema.safeParse({
        ...current,
        title: input.title,
        updatedAt: input.updatedAt,
      });
      if (!parsed.success) return err("invalid-project-write");
      await this.database.projects.put(parsed.data);
      return ok(parsed.data);
    });
  }

  async copyConfiguration(
    input: Parameters<ProjectRepository["copyConfiguration"]>[0],
  ): Promise<Result<ProjectWorkspace, ProjectWriteError>> {
    const targetProject = namingProjectSchema.safeParse(input.workspace.project);
    if (
      !targetProject.success ||
      targetProject.data.id !== input.workspace.profile.projectId ||
      targetProject.data.id === input.sourceProjectId
    )
      return err("invalid-project-write");

    return this.database.transaction(
      "rw",
      [this.database.projects, this.database.profiles],
      async () => {
        const sourceProfile = await this.database.profiles.get(input.sourceProjectId);
        if (!(await this.database.projects.get(input.sourceProjectId)) || !sourceProfile)
          return err("project-not-found");
        if (
          (await this.database.projects.get(targetProject.data.id)) ||
          (await this.database.profiles.get(targetProject.data.id))
        )
          return err("project-id-conflict");

        const targetProfile = namingProfileSchema.safeParse({
          ...sourceProfile,
          projectId: targetProject.data.id,
          configRevision: 0,
        });
        if (!targetProfile.success) return err("invalid-project-write");
        const copied = { project: targetProject.data, profile: targetProfile.data };
        await this.database.projects.add(copied.project);
        await this.database.profiles.add(copied.profile);
        return ok(copied);
      },
    );
  }

  async saveConfiguration(
    input: Parameters<ProjectRepository["saveConfiguration"]>[0],
  ): Promise<Result<ConfigurationWrite, ProjectWriteError>> {
    const parsed = parseWorkspace(input.write.workspace);
    if (
      !parsed ||
      parsed.project.id !== input.projectId ||
      parsed.profile.projectId !== input.projectId
    )
      return err("invalid-project-write");

    return this.database.transaction(
      "rw",
      [this.database.projects, this.database.profiles, this.database.assessmentRuns],
      async () => {
        const [currentProject, currentProfile] = await Promise.all([
          this.database.projects.get(input.projectId),
          this.database.profiles.get(input.projectId),
        ]);
        if (!currentProject || !currentProfile) return err("project-not-found");
        if (currentProfile.configRevision !== input.expectedRevision)
          return err("configuration-stale");

        const validWrite = validateConfigurationWrite(
          input.write,
          input.expectedRevision,
          currentProfile,
        );
        if (!validWrite) return err("invalid-project-write");
        await this.database.projects.put(parsed.project);
        await this.database.profiles.put(parsed.profile);
        if (validWrite.kind === "scoring-inputs-changed")
          await this.database.assessmentRuns.put(validWrite.assessmentRun);
        return ok({ ...validWrite, workspace: parsed });
      },
    );
  }
}

function parseWorkspace(workspace: ProjectWorkspace): ProjectWorkspace | undefined {
  const project = namingProjectSchema.safeParse(workspace.project);
  const profile = namingProfileSchema.safeParse(workspace.profile);
  return project.success && profile.success
    ? { project: project.data, profile: profile.data }
    : undefined;
}

function validateConfigurationWrite(
  write: ConfigurationWrite,
  expectedRevision: number,
  currentProfile: NamingProfile,
): ConfigurationWrite | undefined {
  if (write.kind === "display-only")
    return write.workspace.profile.configRevision === expectedRevision &&
      haveSameScoringInputs(currentProfile, write.workspace.profile)
      ? write
      : undefined;
  const run = assessmentRunSchema.safeParse(write.assessmentRun);
  if (
    write.workspace.profile.configRevision !== expectedRevision + 1 ||
    !run.success ||
    run.data.projectId !== write.workspace.project.id ||
    run.data.configRevision !== write.workspace.profile.configRevision ||
    run.data.status !== "running"
  )
    return undefined;
  return { ...write, assessmentRun: run.data };
}

function haveSameScoringInputs(current: NamingProfile, next: NamingProfile): boolean {
  return (
    JSON.stringify(withoutDisplaySettings(current)) ===
    JSON.stringify(withoutDisplaySettings(next))
  );
}

function withoutDisplaySettings(profile: NamingProfile) {
  return {
    ...profile,
    modules: Object.fromEntries(
      Object.entries(profile.modules).map(
        ([moduleId, { analysisEnabled, weight, schoolId, ruleVersion }]) => [
          moduleId,
          { analysisEnabled, weight, schoolId, ruleVersion },
        ],
      ),
    ),
  };
}
