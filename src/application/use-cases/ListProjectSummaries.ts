import type { GenerationRepository } from "../ports/GenerationRepository";
import type { ProjectRepository } from "../ports/ProjectRepository";
import type { ProjectSummary } from "../models/ProjectSummary";

export class ListProjectSummaries {
  constructor(
    private readonly projects: ProjectRepository,
    private readonly generations: GenerationRepository,
  ) {}

  async execute(): Promise<ProjectSummary[]> {
    const projects = await this.projects.listProjects();
    return Promise.all(
      projects.map(async (project) => {
        const candidates = await this.generations.listCandidates(project.id);
        const workspace = await this.projects.getWorkspace(project.id);
        return {
          id: project.id,
          title: project.title,
          surname: workspace?.profile.surname ?? candidates[0]?.candidate.surname ?? "—",
          stage: project.stage,
          status: project.status,
          candidateCount: candidates.filter(({ decision }) =>
            [
              "favorite",
              "basic_shortlist",
              "folklore_review",
              "comparison",
              "finalist",
            ].includes(decision.stage),
          ).length,
          favoriteCount: candidates.filter(({ decision }) =>
            ["favorite", "basic_shortlist", "folklore_review"].includes(decision.stage),
          ).length,
          finalistCount: candidates.filter(({ decision }) => decision.stage === "finalist")
            .length,
          updatedAt: project.updatedAt,
        };
      }),
    );
  }
}
