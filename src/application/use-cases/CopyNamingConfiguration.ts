import type { ProjectRepository } from "../ports/ProjectRepository";
import { namingProjectSchema } from "../../domain/project/project";
import { err, ok, type Result } from "../../domain/shared/result";
import { ZodError } from "../../domain/shared/zod";

export class CopyNamingConfiguration {
  constructor(
    private readonly projects: ProjectRepository,
    private readonly dependencies: { createId: () => string; now: () => string },
  ) {}

  async execute(input: {
    sourceProjectId: string;
    title: string;
  }): Promise<Result<{ projectId: string }, string>> {
    const source = await this.projects.getWorkspace(input.sourceProjectId);
    if (!source) return err("project-not-found");

    try {
      const projectId = this.dependencies.createId();
      const now = this.dependencies.now();
      const project = namingProjectSchema.parse({
        id: projectId,
        title: input.title,
        stage: "naming",
        status: "active",
        createdAt: now,
        updatedAt: now,
      });
      const copied = await this.projects.copyConfiguration({
        sourceProjectId: input.sourceProjectId,
        workspace: {
          project,
          profile: {
            ...source.profile,
            projectId,
            configRevision: 0,
          },
        },
      });
      return copied.ok ? ok({ projectId }) : err(copied.error);
    } catch (error) {
      return err(
        error instanceof ZodError
          ? error.issues.map((issue) => issue.message).join("；")
          : error instanceof Error
            ? error.message
            : "Unable to copy project configuration",
      );
    }
  }
}
