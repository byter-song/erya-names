import { currentEligibility } from "../../domain/rules/currentEligibility";
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
      ...(input.lastActiveStage ? { lastActiveStage: input.lastActiveStage } : {}),
      ...(input.folkloreReviewed ? { folkloreReviewed: true } : {}),
      updatedAt: input.changedAt,
    });
    await this.database.transaction(
      "rw",
      [
        this.database.candidateDecisions,
        this.database.decisionHistory,
        this.database.finalDecisions,
        this.database.projects,
        this.database.profiles,
        this.database.candidates,
      ],
      async () => {
        const current = await this.database.candidateDecisions.get(input.candidateId);
        if (!current || current.projectId !== input.projectId)
          throw new Error("candidate-not-found");
        if (current.stage !== input.from) throw new Error("decision-state-changed");
        if (
          input.to === "finalist" ||
          (input.to === "comparison" && input.from !== "finalist")
        ) {
          const profile = await this.database.profiles.get(input.projectId);
          const candidate = await this.database.candidates.get(input.candidateId);
          if (!profile || !candidate) throw new Error("方案或候选不存在");
          const issue = currentEligibility(candidate, profile);
          if (issue) throw new Error(issue);
        }
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
          action: "manual",
          changedAt: input.changedAt,
        });
        if (input.from === "finalist" || input.to === "finalist") {
          const finalDecision = await this.database.finalDecisions.get(input.projectId);
          if (finalDecision) {
            await this.database.finalDecisions.delete(input.projectId);
          }
        }
        await this.updateProjectStage(input.projectId, input.changedAt);
      },
    );
    return next;
  }

  async moveMany(input: Parameters<DecisionRepository["moveMany"]>[0]): Promise<void> {
    await this.database.transaction(
      "rw",
      [this.database.candidateDecisions, this.database.decisionHistory, this.database.projects],
      async () => {
        const currentRows = await this.database.candidateDecisions.bulkGet(
          input.moves.map((move) => move.candidateId),
        );
        const currentById = new Map(
          currentRows.flatMap((row) => (row ? [[row.candidateId, row] as const] : [])),
        );
        for (const move of input.moves) {
          const current = currentById.get(move.candidateId);
          if (!current || current.projectId !== input.projectId)
            throw new Error("candidate-not-found");
          if (current.stage !== move.from || current.updatedAt !== move.expectedUpdatedAt)
            throw new Error("auto-filter-preview-stale");
        }
        await this.database.candidateDecisions.bulkPut(
          input.moves.map((move) =>
            candidateDecisionSchema.parse({
              projectId: input.projectId,
              candidateId: move.candidateId,
              stage: move.to,
              updatedAt: input.changedAt,
            }),
          ),
        );
        await this.database.decisionHistory.bulkAdd(
          input.moves.map((move) => ({
            projectId: input.projectId,
            candidateId: move.candidateId,
            from: move.from,
            to: move.to,
            action: "auto_filter_confirmed" as const,
            batchId: input.batchId,
            changedAt: input.changedAt,
          })),
        );
        await this.updateProjectStage(input.projectId, input.changedAt);
      },
    );
  }

  private async updateProjectStage(projectId: string, changedAt: string): Promise<void> {
    const project = await this.database.projects.get(projectId);
    if (!project) return;
    const [finalistCount, comparisonCount, funnelCount] = await Promise.all([
      this.database.candidateDecisions
        .where("[projectId+stage]")
        .equals([projectId, "finalist"])
        .count(),
      this.database.candidateDecisions
        .where("[projectId+stage]")
        .equals([projectId, "comparison"])
        .count(),
      Promise.all(
        ["basic_shortlist", "folklore_review", "favorite"].map((stage) =>
          this.database.candidateDecisions
            .where("[projectId+stage]")
            .equals([projectId, stage])
            .count(),
        ),
      ).then((counts) => counts.reduce((sum, count) => sum + count, 0)),
    ]);
    await this.database.projects.put({
      ...project,
      stage:
        finalistCount > 0
          ? "finalization"
          : comparisonCount > 0
            ? "comparison"
            : funnelCount > 0
              ? "funnel"
              : "generation",
      status: "active",
      updatedAt: changedAt,
    });
  }
}
