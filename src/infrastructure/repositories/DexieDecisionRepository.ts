import type {
  DecisionRepository,
  DecisionWriteError,
} from "../../application/ports/DecisionRepository";
import {
  candidateDecisionSchema,
  normalizeExclusionReason,
  type CandidateDecision,
  type ExcludedCandidateDecision,
} from "../../domain/candidate/decision";
import { moveCandidatePool } from "../../domain/candidate/decisionState";
import { err, ok, type Result } from "../../domain/shared/result";
import type { EryaDatabase } from "../database/EryaDatabase";

export class DexieDecisionRepository implements DecisionRepository {
  constructor(private readonly database: EryaDatabase) {}

  async get(candidateId: string): Promise<CandidateDecision | undefined> {
    const record = await this.database.candidateDecisions.get(candidateId);
    return record ? candidateDecisionSchema.parse(record) : undefined;
  }

  async list(
    projectId: string,
    pool?: CandidateDecision["pool"],
  ): Promise<CandidateDecision[]> {
    const records = pool
      ? await this.database.candidateDecisions
          .where("[projectId+pool]")
          .equals([projectId, pool])
          .toArray()
      : await this.database.candidateDecisions.where("projectId").equals(projectId).toArray();
    return records.map((record) => candidateDecisionSchema.parse(record));
  }

  async move(
    input: Parameters<DecisionRepository["move"]>[0],
  ): Promise<Result<CandidateDecision, DecisionWriteError>> {
    return this.database.transaction(
      "rw",
      [this.database.candidateDecisions, this.database.decisionHistory],
      async () => {
        const current = await this.database.candidateDecisions.get(input.candidateId);
        if (!current) return err("candidate-not-found");
        if (current.projectId !== input.projectId) return err("candidate-project-mismatch");
        if (current.updatedAt !== input.expectedUpdatedAt) return err("candidate-stale");
        const from = current.pool;
        const to = moveCandidatePool(from, input.direction);
        if (!to) return err("invalid-transition");
        const next = candidateDecisionSchema.parse({
          candidateId: current.candidateId,
          projectId: current.projectId,
          pool: to,
          updatedAt: input.changedAt,
        });
        await this.database.candidateDecisions.put(next);
        await this.database.decisionHistory.add({
          projectId: input.projectId,
          candidateId: input.candidateId,
          from,
          to,
          action: input.direction,
          changedAt: input.changedAt,
        });
        return ok(next);
      },
    );
  }

  async exclude(
    input: Parameters<DecisionRepository["exclude"]>[0],
  ): ReturnType<DecisionRepository["exclude"]> {
    return this.database.transaction(
      "rw",
      [this.database.candidateDecisions, this.database.decisionHistory],
      async () => {
        const current = await this.database.candidateDecisions.get(input.candidateId);
        if (!current) return err("candidate-not-found");
        if (current.projectId !== input.projectId) return err("candidate-project-mismatch");
        if (current.updatedAt !== input.expectedUpdatedAt) return err("candidate-stale");
        if (current.pool === "excluded") return err("invalid-transition");
        const exclusionReason = normalizeExclusionReason(input.reason);
        const next = candidateDecisionSchema.parse({
          candidateId: current.candidateId,
          projectId: current.projectId,
          pool: "excluded",
          lastActivePool: current.pool,
          exclusionReason,
          excludedAt: input.changedAt,
          updatedAt: input.changedAt,
        }) as ExcludedCandidateDecision;
        await this.database.candidateDecisions.put(next);
        await this.database.decisionHistory.add({
          projectId: input.projectId,
          candidateId: input.candidateId,
          from: current.pool,
          to: "excluded",
          action: "exclude",
          exclusionReason,
          changedAt: input.changedAt,
        });
        return ok(next);
      },
    );
  }

  async restore(
    input: Parameters<DecisionRepository["restore"]>[0],
  ): ReturnType<DecisionRepository["restore"]> {
    return this.database.transaction(
      "rw",
      [this.database.candidateDecisions, this.database.decisionHistory],
      async () => {
        const current = await this.database.candidateDecisions.get(input.candidateId);
        if (!current) return err("candidate-not-found");
        if (current.projectId !== input.projectId) return err("candidate-project-mismatch");
        if (current.updatedAt !== input.expectedUpdatedAt) return err("candidate-stale");
        if (current.pool !== "excluded") return err("candidate-not-excluded");
        const next = candidateDecisionSchema.parse({
          candidateId: current.candidateId,
          projectId: current.projectId,
          pool: current.lastActivePool,
          updatedAt: input.changedAt,
        });
        await this.database.candidateDecisions.put(next);
        await this.database.decisionHistory.add({
          projectId: input.projectId,
          candidateId: input.candidateId,
          from: "excluded",
          to: current.lastActivePool,
          action: "restore",
          exclusionReason: current.exclusionReason,
          changedAt: input.changedAt,
        });
        return ok(next);
      },
    );
  }

  async clearExcluded(
    input: Parameters<DecisionRepository["clearExcluded"]>[0],
  ): ReturnType<DecisionRepository["clearExcluded"]> {
    if (input.candidates.length === 0) return Promise.resolve(ok({ deleted: 0 }));
    const candidateIds = input.candidates.map((candidate) => candidate.candidateId);
    if (new Set(candidateIds).size !== candidateIds.length)
      return Promise.resolve(err("candidate-stale"));

    return this.database.transaction(
      "rw",
      [
        this.database.candidates,
        this.database.candidateSources,
        this.database.candidateDecisions,
        this.database.decisionHistory,
        this.database.candidateEvaluations,
        this.database.ruleEvidence,
        this.database.candidateScores,
      ],
      async () => {
        const [candidateRows, decisionRows] = await Promise.all([
          this.database.candidates.bulkGet(candidateIds),
          this.database.candidateDecisions.bulkGet(candidateIds),
        ]);
        for (let index = 0; index < input.candidates.length; index += 1) {
          const expected = input.candidates[index]!;
          const candidate = candidateRows[index];
          const decision = decisionRows[index];
          if (!candidate || !decision) return err("candidate-not-found");
          if (candidate.projectId !== input.projectId || decision.projectId !== input.projectId)
            return err("candidate-project-mismatch");
          if (decision.updatedAt !== expected.expectedUpdatedAt) return err("candidate-stale");
          if (decision.pool !== "excluded") return err("candidate-not-excluded");
        }

        await Promise.all([
          this.database.candidates.bulkDelete(candidateIds),
          this.database.candidateSources.where("candidateId").anyOf(candidateIds).delete(),
          this.database.candidateDecisions.bulkDelete(candidateIds),
          this.database.decisionHistory.where("candidateId").anyOf(candidateIds).delete(),
          this.database.candidateEvaluations.bulkDelete(candidateIds),
          this.database.ruleEvidence.where("candidateId").anyOf(candidateIds).delete(),
          this.database.candidateScores.bulkDelete(candidateIds),
        ]);
        return ok({ deleted: candidateIds.length });
      },
    );
  }
}
