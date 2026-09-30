import type { ProjectRepository, ProjectWorkspace } from "../ports/ProjectRepository";
import { err, ok, type Result } from "../../domain/shared/result";

export class GetProjectWorkspace {
  constructor(private readonly repository: ProjectRepository) {}

  async execute(projectId: string): Promise<Result<ProjectWorkspace, "project-not-found">> {
    const workspace = await this.repository.getWorkspace(projectId);
    return workspace ? ok(workspace) : err("project-not-found");
  }
}
