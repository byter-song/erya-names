import { ZodError } from "zod";
import type { ProjectRepository, ProjectWorkspace } from "../ports/ProjectRepository";
import { namingProfileSchema, type NamingProfile } from "../../domain/project/profile";
import { namingProjectSchema } from "../../domain/project/project";
import { err, ok, type Result } from "../../domain/shared/result";

type ProfilePatch = Partial<Omit<NamingProfile, "projectId">>;

export class UpdateNamingProfile {
  constructor(
    private readonly repository: ProjectRepository,
    private readonly dependencies: { now: () => string },
  ) {}

  async execute(input: {
    projectId: string;
    patch: ProfilePatch;
    completeOnboarding: boolean;
  }): Promise<Result<ProjectWorkspace, string>> {
    const current = await this.repository.getWorkspace(input.projectId);
    if (!current) return err("project-not-found");

    try {
      const profile = namingProfileSchema.parse({ ...current.profile, ...input.patch });
      const now = this.dependencies.now();
      const project = namingProjectSchema.parse({
        ...current.project,
        stage: input.completeOnboarding ? "generation" : current.project.stage,
        status: input.completeOnboarding ? "active" : current.project.status,
        updatedAt: now,
      });
      const workspace = { project, profile };
      await this.repository.updateProfile(workspace);
      return ok(workspace);
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
