import type { BackupRepository } from "../../application/ports/BackupRepository";
import { backupPayloadSchema, type BackupPayload } from "../backup/backupSchema";
import type { EryaDatabase } from "../database/EryaDatabase";

export class DexieBackupRepository implements BackupRepository {
  constructor(
    private readonly database: EryaDatabase,
    private readonly hooks: { beforeWrite?: () => void } = {},
  ) {}

  async hasProject(projectId: string): Promise<boolean> {
    return (await this.database.projects.get(projectId)) !== undefined;
  }

  async exportProject(projectId: string): Promise<unknown | undefined> {
    const project = await this.database.projects.get(projectId);
    if (!project) return undefined;

    const [
      profiles,
      generationBatches,
      candidates,
      candidateDecisions,
      decisionHistory,
      candidateEvaluations,
      comparisonSnapshots,
      finalDecisions,
    ] = await Promise.all([
      this.database.profiles.where("projectId").equals(projectId).toArray(),
      this.database.generationBatches.where("projectId").equals(projectId).toArray(),
      this.database.candidates.where("projectId").equals(projectId).toArray(),
      this.database.candidateDecisions.where("projectId").equals(projectId).toArray(),
      this.database.decisionHistory.where("projectId").equals(projectId).toArray(),
      this.database.candidateEvaluations.where("projectId").equals(projectId).toArray(),
      this.database.comparisonSnapshots.where("projectId").equals(projectId).toArray(),
      this.database.finalDecisions.where("projectId").equals(projectId).toArray(),
    ]);
    const candidateIds = candidates.map((candidate) => candidate.id);
    const [candidateSources, ruleResults] =
      candidateIds.length > 0
        ? await Promise.all([
            this.database.candidateSources.where("candidateId").anyOf(candidateIds).toArray(),
            this.database.ruleResults.where("candidateId").anyOf(candidateIds).toArray(),
          ])
        : [[], []];

    return {
      projectId,
      projects: [project],
      profiles,
      generationBatches,
      candidates,
      candidateSources,
      ruleResults,
      candidateDecisions,
      decisionHistory,
      candidateEvaluations,
      comparisonSnapshots,
      finalDecisions,
    };
  }

  async importProject(
    input: unknown,
    options: {
      strategy: "keep-current" | "replace" | "import-copy";
      copyProjectId?: string;
    },
  ): Promise<{ projectId: string; action: "kept" | "replaced" | "imported" }> {
    const payload = backupPayloadSchema.parse(input);
    if (options.strategy === "keep-current") {
      return { projectId: payload.projectId, action: "kept" };
    }
    const restored =
      options.strategy === "import-copy"
        ? remapProject(payload, options.copyProjectId ?? "")
        : payload;
    const projectId = restored.projectId;
    const tables = [
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
    ];

    await this.database.transaction("rw", tables, async () => {
      if (options.strategy === "replace") await this.deleteProjectRecords(projectId);
      this.hooks.beforeWrite?.();
      await this.database.projects.bulkPut(restored.projects);
      await this.database.profiles.bulkPut(
        restored.profiles.map(({ dialectNotes, folklore, ...profile }) => ({
          ...profile,
          ...(dialectNotes !== undefined ? { dialectNotes } : {}),
          folklore: {
            enabled: folklore.enabled,
            usefulElements: folklore.usefulElements,
            includeInRanking: folklore.includeInRanking,
            ...(folklore.birthLocalDateTime !== undefined
              ? { birthLocalDateTime: folklore.birthLocalDateTime }
              : {}),
            ...(folklore.timeZone !== undefined ? { timeZone: folklore.timeZone } : {}),
          },
        })),
      );
      await this.database.generationBatches.bulkPut(restored.generationBatches);
      await this.database.candidates.bulkPut(restored.candidates);
      await this.database.candidateSources.bulkPut(
        restored.candidateSources.map(
          ({ title, work, quote, location, excerpt, ...source }) => ({
            ...source,
            ...(title !== undefined ? { title } : {}),
            ...(work !== undefined ? { work } : {}),
            ...(quote !== undefined ? { quote } : {}),
            ...(location !== undefined ? { location } : {}),
            ...(excerpt !== undefined ? { excerpt } : {}),
          }),
        ),
      );
      await this.database.ruleResults.bulkPut(
        restored.ruleResults.map(({ scoreDelta, ...record }) => ({
          ...record,
          ...(scoreDelta !== undefined ? { scoreDelta } : {}),
        })),
      );
      await this.database.candidateDecisions.bulkPut(restored.candidateDecisions);
      await this.database.decisionHistory.bulkPut(
        restored.decisionHistory.map(({ id, ...record }) => ({
          ...record,
          ...(id !== undefined ? { id } : {}),
        })),
      );
      await this.database.candidateEvaluations.bulkPut(
        restored.candidateEvaluations.map(({ rating, note, ...record }) => ({
          ...record,
          ...(rating !== undefined ? { rating } : {}),
          ...(note !== undefined ? { note } : {}),
        })),
      );
      await this.database.comparisonSnapshots.bulkPut(restored.comparisonSnapshots);
      await this.database.finalDecisions.bulkPut(restored.finalDecisions);
    });

    return {
      projectId,
      action: options.strategy === "replace" ? "replaced" : "imported",
    };
  }

  private async deleteProjectRecords(projectId: string): Promise<void> {
    const candidates = await this.database.candidates
      .where("projectId")
      .equals(projectId)
      .toArray();
    const candidateIds = candidates.map((candidate) => candidate.id);
    if (candidateIds.length > 0) {
      await this.database.candidateSources.where("candidateId").anyOf(candidateIds).delete();
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
  }
}

function remapProject(payload: BackupPayload, newProjectId: string): BackupPayload {
  if (!newProjectId) throw new Error("copy-project-id-required");
  const remapId = (id: string) => `${newProjectId}:${id}`;
  const batches = new Map(
    payload.generationBatches.map((record) => [record.id, remapId(record.id)]),
  );
  const candidates = new Map(
    payload.candidates.map((record) => [record.id, remapId(record.id)]),
  );
  const mapCandidateId = (candidateId: string) => candidates.get(candidateId) ?? candidateId;

  return {
    projectId: newProjectId,
    projects: payload.projects.map((record) => ({
      ...record,
      id: newProjectId,
      title: `${String(record.title ?? "导入方案")}（副本）`,
    })),
    profiles: payload.profiles.map((record) => ({ ...record, projectId: newProjectId })),
    generationBatches: payload.generationBatches.map((record) => ({
      ...record,
      projectId: newProjectId,
      id: batches.get(record.id) ?? record.id,
      profileSnapshot: { ...record.profileSnapshot, projectId: newProjectId },
    })),
    candidates: payload.candidates.map((record) => ({
      ...record,
      projectId: newProjectId,
      id: candidates.get(record.id) ?? record.id,
      batchId: record.batchId ? (batches.get(record.batchId) ?? record.batchId) : null,
    })),
    candidateSources: payload.candidateSources.map((record) => ({
      ...record,
      projectId: newProjectId,
      ...(typeof record.candidateId === "string"
        ? { candidateId: mapCandidateId(record.candidateId) }
        : {}),
      id: remapId(record.id),
    })),
    ruleResults: payload.ruleResults.map((record) => ({
      ...record,
      projectId: newProjectId,
      candidateId: mapCandidateId(record.candidateId),
      id: remapId(record.id),
    })),
    candidateDecisions: payload.candidateDecisions.map((record) => ({
      ...record,
      projectId: newProjectId,
      candidateId: mapCandidateId(record.candidateId),
    })),
    decisionHistory: payload.decisionHistory.map((record) => {
      const withoutId = { ...record };
      delete withoutId.id;
      return {
        ...withoutId,
        projectId: newProjectId,
        candidateId: mapCandidateId(record.candidateId),
      };
    }),
    candidateEvaluations: payload.candidateEvaluations.map((record) => ({
      ...record,
      projectId: newProjectId,
      candidateId: mapCandidateId(record.candidateId),
    })),
    comparisonSnapshots: payload.comparisonSnapshots.map((record) => ({
      ...record,
      projectId: newProjectId,
      id: remapId(record.id),
      candidateIds: record.candidateIds.map(mapCandidateId),
      candidates: record.candidates.map((candidate) => ({
        ...candidate,
        id: mapCandidateId(candidate.id),
      })),
    })),
    finalDecisions: payload.finalDecisions.map((record) => ({
      ...record,
      projectId: newProjectId,
      selectedCandidateId: mapCandidateId(record.selectedCandidateId),
    })),
  };
}
