import type { ProjectRepository } from "../ports/ProjectRepository";
import { err, ok, type Result } from "../../domain/shared/result";

export class RenameNamingProject {
  constructor(
    private readonly projects: ProjectRepository,
    private readonly dependencies: { now: () => string },
  ) {}

  async execute(input: {
    projectId: string;
    title: string;
    expectedUpdatedAt: string;
  }): Promise<Result<void, string>> {
    try {
      const renamed = await this.projects.rename({
        ...input,
        updatedAt: this.dependencies.now(),
      });
      return renamed.ok ? ok(undefined) : err(renamed.error);
    } catch (error) {
      return err(error instanceof Error ? error.message : "Unable to rename project");
    }
  }
}
