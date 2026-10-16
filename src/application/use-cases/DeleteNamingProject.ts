import type { ProjectRepository } from "../ports/ProjectRepository";
import { err, ok, type Result } from "../../domain/shared/result";

export class DeleteNamingProject {
  constructor(private readonly repository: ProjectRepository) {}

  async execute(projectId: string): Promise<Result<void, string>> {
    try {
      const deleted = await this.repository.deleteProject(projectId);
      return deleted.ok ? ok(undefined) : err(deleted.error);
    } catch (error) {
      return err(error instanceof Error ? error.message : "Unable to delete project");
    }
  }
}
