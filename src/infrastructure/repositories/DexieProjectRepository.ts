import type {
  ProjectRepository,
  ProjectWorkspace,
} from "../../application/ports/ProjectRepository";
import type { NamingProfile } from "../../domain/project/profile";
import type { NamingProject } from "../../domain/project/project";
import type { EryaDatabase } from "../database/EryaDatabase";

export class DexieProjectRepository implements ProjectRepository {
  constructor(private readonly database: EryaDatabase) {}

  async create(workspace: ProjectWorkspace): Promise<void> {
    await this.database.transaction(
      "rw",
      [this.database.projects, this.database.profiles],
      async () => {
        await this.database.projects.add(workspace.project);
        await this.database.profiles.add(workspace.profile);
      },
    );
  }

  async deleteProject(projectId: string): Promise<boolean> {
    return this.database.transaction(
      "rw",
      [
        this.database.projects,
        this.database.profiles,
        this.database.generationBatches,
        this.database.candidates,
        this.database.candidateSources,
        this.database.ruleResults,
        this.database.candidateDecisions,
        this.database.decisionHistory,
        this.database.candidateEvaluations,
        this.database.comparisonSnapshots,
        this.database.finalDecisions,
      ],
      async () => {
        if (!(await this.database.projects.get(projectId))) return false;

        const candidateIds = await this.database.candidates
          .where("projectId")
          .equals(projectId)
          .primaryKeys();
        if (candidateIds.length > 0) {
          await this.database.candidateSources
            .where("candidateId")
            .anyOf(candidateIds)
            .delete();
          await this.database.ruleResults.where("candidateId").anyOf(candidateIds).delete();
        }
        await Promise.all([
          this.database.projects.delete(projectId),
          this.database.profiles.delete(projectId),
          this.database.generationBatches.where("projectId").equals(projectId).delete(),
          this.database.candidates.where("projectId").equals(projectId).delete(),
          this.database.candidateDecisions.where("projectId").equals(projectId).delete(),
          this.database.decisionHistory.where("projectId").equals(projectId).delete(),
          this.database.candidateEvaluations.where("projectId").equals(projectId).delete(),
          this.database.comparisonSnapshots.where("projectId").equals(projectId).delete(),
          this.database.finalDecisions.where("projectId").equals(projectId).delete(),
        ]);
        return true;
      },
    );
  }

  async listProjects(): Promise<NamingProject[]> {
    const records = await this.database.projects.orderBy("updatedAt").reverse().toArray();
    return records as unknown as NamingProject[];
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
      project: project as unknown as NamingProject,
      profile: profile as unknown as NamingProfile,
    };
  }

  async updateProfile(input: {
    project: NamingProject;
    profile: NamingProfile;
  }): Promise<void> {
    await this.database.transaction(
      "rw",
      [this.database.projects, this.database.profiles],
      async () => {
        await this.database.projects.put(input.project);
        await this.database.profiles.put(input.profile);
      },
    );
  }
}
