import { currentEligibility } from "../../domain/rules/currentEligibility";
import type { FinalDecisionRepository } from "../../application/ports/FinalDecisionRepository";
import { finalDecisionSchema, type FinalDecision } from "../../domain/candidate/finalDecision";
import type { EryaDatabase } from "../database/EryaDatabase";

export class DexieFinalDecisionRepository implements FinalDecisionRepository {
  constructor(private readonly database: EryaDatabase) {}

  async listFinalistIds(projectId: string): Promise<string[]> {
    const decisions = await this.database.candidateDecisions
      .where("[projectId+stage]")
      .equals([projectId, "finalist"])
      .toArray();
    return decisions.map((decision) => decision.candidateId);
  }

  async saveAndCompleteProject(decision: FinalDecision): Promise<void> {
    await this.database.transaction(
      "rw",
      [
        this.database.finalDecisions,
        this.database.projects,
        this.database.candidateDecisions,
        this.database.profiles,
        this.database.candidates,
      ],
      async () => {
        const project = await this.database.projects.get(decision.projectId);
        if (!project) throw new Error("project-not-found");
        const finalists = await this.database.candidateDecisions
          .where("[projectId+stage]")
          .equals([decision.projectId, "finalist"])
          .toArray();
        if (finalists.length < 1 || finalists.length > 5)
          throw new Error("最终候选需要保持在 1 到 5 个");
        if (!finalists.some((item) => item.candidateId === decision.selectedCandidateId))
          throw new Error("最终选择必须来自最终候选");
        const profile = await this.database.profiles.get(decision.projectId);
        for (const row of finalists) {
          const candidate = await this.database.candidates.get(row.candidateId);
          if (!profile || !candidate) throw new Error("方案或候选不存在");
          const issue = currentEligibility(candidate, profile);
          if (issue) throw new Error(`${candidate.fullName}：${issue}`);
        }
        await this.database.finalDecisions.put(decision);
        await this.database.projects.put({
          ...project,
          stage: "finalization",
          status: "completed",
          updatedAt: decision.updatedAt,
        });
      },
    );
  }

  async get(projectId: string): Promise<FinalDecision | undefined> {
    const record = await this.database.finalDecisions.get(projectId);
    return record ? finalDecisionSchema.parse(record) : undefined;
  }
}
