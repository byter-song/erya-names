import type { DecisionRepository } from "../../application/ports/DecisionRepository";
import {
  candidateDecisionSchema,
  type CandidateDecision,
} from "../../domain/candidate/decision";
import type { EryaDatabase } from "../database/EryaDatabase";

export class DexieDecisionRepository implements DecisionRepository {
  constructor(private readonly database: EryaDatabase) {}

  async get(candidateId: string): Promise<CandidateDecision | undefined> {
    const record = await this.database.candidateDecisions.get(candidateId);
    return record ? candidateDecisionSchema.parse(record) : undefined;
  }

  async move(input: Parameters<DecisionRepository["move"]>[0]): Promise<CandidateDecision> {
    const next = candidateDecisionSchema.parse({
      projectId: input.projectId,
      candidateId: input.candidateId,
      stage: input.to,
      ...(input.rejectionReason ? { rejectionReason: input.rejectionReason } : {}),
      updatedAt: input.changedAt,
    });
    await this.database.transaction(
      "rw",
      [
        this.database.candidateDecisions,
        this.database.decisionHistory,
        this.database.finalDecisions,
        this.database.projects,
      ],
      async () => {
        const current = await this.database.candidateDecisions.get(input.candidateId);
        if (!current || current.projectId !== input.projectId)
          throw new Error("candidate-not-found");
        if (current.stage !== input.from) throw new Error("decision-state-changed");
        if (input.maximumTargetCount !== undefined) {
          const count = await this.database.candidateDecisions
            .where("[projectId+stage]")
            .equals([input.projectId, input.to])
            .count();
          if (count >= input.maximumTargetCount) throw new Error(`${input.to}-pool-full`);
        }
        await this.database.candidateDecisions.put(next);
        await this.database.decisionHistory.add({
          projectId: input.projectId,
          candidateId: input.candidateId,
          from: input.from,
          to: input.to,
          changedAt: input.changedAt,
        });
        if (input.from === "finalist" || input.to === "finalist") {
          const finalDecision = await this.database.finalDecisions.get(input.projectId);
          if (finalDecision) {
            await this.database.finalDecisions.delete(input.projectId);
            const project = await this.database.projects.get(input.projectId);
            if (project) {
              await this.database.projects.put({
                ...project,
                stage: "comparison",
                status: "active",
                updatedAt: input.changedAt,
              });
            }
          }
        }
      },
    );
    return next;
  }
}
