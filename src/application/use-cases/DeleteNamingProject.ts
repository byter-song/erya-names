import type { ProjectRepository } from "../ports/ProjectRepository";
import { err, ok, type Result } from "../../domain/shared/result";

export class DeleteNamingProject {
  constructor(private readonly repository: ProjectRepository) {}

  async execute(projectId: string): Promise<Result<void, string>> {
    try {
      return (await this.repository.deleteProject(projectId))
        ? ok(undefined)
        : err("project-not-found");
    } catch (error) {
      return err(error instanceof Error ? error.message : "Unable to delete project");
    }
  }
}
