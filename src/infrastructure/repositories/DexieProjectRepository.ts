import type {
  FolkloreReviewUpdate,
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

  async updateFolkloreReview(input: FolkloreReviewUpdate) {
    await this.database.transaction(
      "rw",
      [
        this.database.projects,
        this.database.profiles,
        this.database.candidates,
        this.database.ruleResults,
        this.database.candidateDecisions,
      ],
      async () => {
        const currentProject = await this.database.projects.get(input.workspace.project.id);
        if (!currentProject || currentProject.updatedAt !== input.expectedProjectUpdatedAt)
          throw new Error("方案设置已在其他窗口更新，请刷新后重试。");

        const candidateIds = input.candidateResults.map((item) => item.candidateId);
        const decisions = candidateIds.length
          ? await this.database.candidateDecisions.bulkGet(candidateIds)
          : [];
        if (decisions.some((decision) => !decision || decision.stage !== "folklore_review"))
          throw new Error("民俗候选已在其他窗口变化，请刷新后重新评估。");
        const existingL4 = candidateIds.length
          ? await this.database.ruleResults
              .where("candidateId")
              .anyOf(candidateIds)
              .filter((record) => record.evidenceLevel === "L4")
              .primaryKeys()
          : [];
        if (existingL4.length) await this.database.ruleResults.bulkDelete(existingL4);

        const nextResults = input.candidateResults.flatMap(({ candidateId, result }) =>
          result
            ? [
                {
                  id: `${candidateId}:${result.ruleId}:folklore-review`,
                  projectId: input.workspace.project.id,
                  candidateId,
                  evidenceLevel: result.evidenceLevel,
                  outcome: result.outcome,
                  ruleId: result.ruleId,
                  ruleVersion: result.ruleVersion,
                  explanation: result.explanation,
                  sourceRefs: result.sourceRefs,
                  ...(result.scoreDelta !== undefined ? { scoreDelta: result.scoreDelta } : {}),
                },
              ]
            : [],
        );
        if (nextResults.length) await this.database.ruleResults.bulkPut(nextResults);

        const candidates = candidateIds.length
          ? await this.database.candidates.bulkGet(candidateIds)
          : [];
        const resultsByCandidate = new Map(
          input.candidateResults.map((item) => [item.candidateId, item.result]),
        );
        const updatedCandidates = candidates.flatMap((candidate) => {
          if (!candidate) return [];
          const result = resultsByCandidate.get(candidate.id);
          return [
            {
              ...candidate,
              ruleResults: [
                ...candidate.ruleResults.filter((rule) => rule.evidenceLevel !== "L4"),
                ...(result ? [result] : []),
              ],
            },
          ];
        });
        if (updatedCandidates.length) await this.database.candidates.bulkPut(updatedCandidates);

        await this.database.projects.put(input.workspace.project);
        await this.database.profiles.put(input.workspace.profile);
      },
    );
  }
}
