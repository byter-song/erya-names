import type { CandidatePool } from "../../domain/candidate/decision";
import type { ProjectSummary } from "../models/ProjectSummary";
import type { GenerationRepository } from "../ports/GenerationRepository";
import type { ProjectRepository } from "../ports/ProjectRepository";

export class ListProjectSummaries {
  constructor(
    private readonly projects: ProjectRepository,
    private readonly generations: GenerationRepository,
  ) {}

  async execute(): Promise<ProjectSummary[]> {
    const projects = await this.projects.listProjects();
    const summaries = await Promise.all(
      projects.map(async (project): Promise<ProjectSummary> => {
        const [candidates, workspace] = await Promise.all([
          this.generations.listCandidates(project.id),
          this.projects.getWorkspace(project.id),
        ]);
        const poolCounts: Record<CandidatePool, number> = {
          inspiration: 0,
          candidate: 0,
          selected: 0,
          excluded: 0,
        };
        for (const { decision } of candidates) poolCounts[decision.pool] += 1;
        return {
          id: project.id,
          title: project.title,
          surname: workspace?.profile.basics.surname ?? candidates[0]?.candidate.surname ?? "—",
          stage: project.stage,
          status: project.status,
          poolCounts,
          totalCandidateCount: candidates.length,
          updatedAt: project.updatedAt,
        };
      }),
    );
    return summaries.sort(
      (left, right) =>
        right.updatedAt.localeCompare(left.updatedAt) || left.id.localeCompare(right.id),
    );
  }
}
