import { backupPayloadSchema, type BackupPayload } from "../../application/backup/backupSchema";
import type {
  BackupConflictStrategy,
  BackupImportAction,
  BackupRepository,
} from "../../application/ports/BackupRepository";
import type { EryaDatabase } from "../database/EryaDatabase";

const metadataPrefix = (projectId: string) => `project:${projectId}:`;

export class DexieBackupRepository implements BackupRepository {
  constructor(
    private readonly database: EryaDatabase,
    private readonly hooks: { beforeWrite?: () => void } = {},
  ) {}

  async hasProject(projectId: string): Promise<boolean> {
    return (await this.database.projects.get(projectId)) !== undefined;
  }

  async exportProject(projectId: string): Promise<BackupPayload | undefined> {
    const project = await this.database.projects.get(projectId);
    if (!project) return undefined;

    const [
      profile,
      generationBatches,
      candidates,
      candidateSources,
      candidateDecisions,
      decisionHistory,
      candidateEvaluations,
      projectAssessments,
      ruleEvidence,
      candidateScores,
      assessmentRun,
      appMetadata,
    ] = await Promise.all([
      this.database.profiles.get(projectId),
      this.database.generationBatches.where("projectId").equals(projectId).toArray(),
      this.database.candidates.where("projectId").equals(projectId).toArray(),
      this.database.candidateSources.where("projectId").equals(projectId).toArray(),
      this.database.candidateDecisions.where("projectId").equals(projectId).toArray(),
      this.database.decisionHistory.where("projectId").equals(projectId).toArray(),
      this.database.candidateEvaluations.where("projectId").equals(projectId).toArray(),
      this.database.projectAssessments.where("projectId").equals(projectId).toArray(),
      this.database.ruleEvidence.where("projectId").equals(projectId).toArray(),
      this.database.candidateScores.where("projectId").equals(projectId).toArray(),
      this.database.assessmentRuns.get(projectId),
      this.database.appMetadata.where("key").startsWith(metadataPrefix(projectId)).toArray(),
    ]);
    if (!profile) throw new Error("project-profile-not-found");

    return backupPayloadSchema.parse({
      projectId,
      projects: [project],
      profiles: [profile],
      generationBatches,
      candidates,
      candidateSources,
      candidateDecisions,
      decisionHistory,
      candidateEvaluations,
      projectAssessments,
      ruleEvidence,
      candidateScores,
      assessmentRuns: assessmentRun ? [assessmentRun] : [],
      appMetadata,
    });
  }

  async importProject(
    input: BackupPayload,
    options: {
      strategy: BackupConflictStrategy;
      copyProjectId?: string;
    },
  ): Promise<{ projectId: string; action: BackupImportAction }> {
    const payload = backupPayloadSchema.parse(input);
    if (options.strategy === "keep-current")
      return { projectId: payload.projectId, action: "kept" };

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
      this.database.candidateDecisions,
      this.database.decisionHistory,
      this.database.candidateEvaluations,
      this.database.projectAssessments,
      this.database.ruleEvidence,
      this.database.candidateScores,
      this.database.assessmentRuns,
      this.database.appMetadata,
    ];

    await this.database.transaction("rw", tables, async () => {
      if (options.strategy === "replace") await this.deleteProjectRecords(projectId);
      this.hooks.beforeWrite?.();
      await this.database.projects.bulkPut(restored.projects);
      await this.database.profiles.bulkPut(restored.profiles);
      await this.database.generationBatches.bulkPut(restored.generationBatches);
      await this.database.candidates.bulkPut(restored.candidates);
      await this.database.candidateSources.bulkPut(
        restored.candidateSources.map(
          ({ title, work, quote, location, excerpt, url, revision, ...source }) => ({
            ...source,
            ...(title !== undefined ? { title } : {}),
            ...(work !== undefined ? { work } : {}),
            ...(quote !== undefined ? { quote } : {}),
            ...(location !== undefined ? { location } : {}),
            ...(excerpt !== undefined ? { excerpt } : {}),
            ...(url !== undefined ? { url } : {}),
            ...(revision !== undefined ? { revision } : {}),
          }),
        ),
      );
      await this.database.candidateDecisions.bulkPut(restored.candidateDecisions);
      await this.database.decisionHistory.bulkPut(
        restored.decisionHistory.map(
          ({ projectId, candidateId, from, to, action, exclusionReason, changedAt }) => ({
            projectId,
            candidateId,
            from,
            to,
            action,
            changedAt,
            ...(exclusionReason !== undefined ? { exclusionReason } : {}),
          }),
        ),
      );
      await this.database.candidateEvaluations.bulkPut(restored.candidateEvaluations);
      await this.database.projectAssessments.bulkPut(restored.projectAssessments);
      await this.database.ruleEvidence.bulkPut(restored.ruleEvidence);
      await this.database.candidateScores.bulkPut(restored.candidateScores);
      await this.database.assessmentRuns.bulkPut(restored.assessmentRuns);
      await this.database.appMetadata.bulkPut(restored.appMetadata);
    });

    return {
      projectId,
      action: options.strategy === "replace" ? "replaced" : "imported",
    };
  }

  private async deleteProjectRecords(projectId: string): Promise<void> {
    await Promise.all([
      this.database.projects.delete(projectId),
      this.database.profiles.delete(projectId),
      this.database.generationBatches.where("projectId").equals(projectId).delete(),
      this.database.candidates.where("projectId").equals(projectId).delete(),
      this.database.candidateSources.where("projectId").equals(projectId).delete(),
      this.database.candidateDecisions.where("projectId").equals(projectId).delete(),
      this.database.decisionHistory.where("projectId").equals(projectId).delete(),
      this.database.candidateEvaluations.where("projectId").equals(projectId).delete(),
      this.database.projectAssessments.where("projectId").equals(projectId).delete(),
      this.database.ruleEvidence.where("projectId").equals(projectId).delete(),
      this.database.candidateScores.where("projectId").equals(projectId).delete(),
      this.database.assessmentRuns.delete(projectId),
      this.database.appMetadata.where("key").startsWith(metadataPrefix(projectId)).delete(),
    ]);
  }
}

function remapProject(payload: BackupPayload, newProjectId: string): BackupPayload {
  if (!newProjectId) throw new Error("copy-project-id-required");
  const remapId = (id: string) => `${newProjectId}:${id}`;
  const batchIds = new Map(payload.generationBatches.map(({ id }) => [id, remapId(id)]));
  const candidateIds = new Map(payload.candidates.map(({ id }) => [id, remapId(id)]));
  const candidateId = (id: string) => candidateIds.get(id) ?? id;
  const oldMetadataPrefix = metadataPrefix(payload.projectId);

  return backupPayloadSchema.parse({
    projectId: newProjectId,
    projects: payload.projects.map((project) => ({
      ...project,
      id: newProjectId,
      title: `${project.title}（副本）`,
    })),
    profiles: payload.profiles.map((profile) => ({
      ...profile,
      projectId: newProjectId,
    })),
    generationBatches: payload.generationBatches.map((batch) => ({
      ...batch,
      id: batchIds.get(batch.id) ?? batch.id,
      projectId: newProjectId,
      profileSnapshot: { ...batch.profileSnapshot, projectId: newProjectId },
    })),
    candidates: payload.candidates.map((candidate) => ({
      ...candidate,
      id: candidateId(candidate.id),
      projectId: newProjectId,
      batchId:
        candidate.batchId === null
          ? null
          : (batchIds.get(candidate.batchId) ?? candidate.batchId),
    })),
    candidateSources: payload.candidateSources.map((source) => ({
      ...source,
      id: remapId(source.id),
      projectId: newProjectId,
      candidateId: candidateId(source.candidateId),
    })),
    candidateDecisions: payload.candidateDecisions.map((decision) => ({
      ...decision,
      projectId: newProjectId,
      candidateId: candidateId(decision.candidateId),
    })),
    decisionHistory: payload.decisionHistory.map(
      ({ candidateId: oldCandidateId, from, to, action, exclusionReason, changedAt }) => ({
        projectId: newProjectId,
        candidateId: candidateId(oldCandidateId),
        from,
        to,
        action,
        changedAt,
        ...(exclusionReason !== undefined ? { exclusionReason } : {}),
      }),
    ),
    candidateEvaluations: payload.candidateEvaluations.map((evaluation) => ({
      ...evaluation,
      projectId: newProjectId,
      candidateId: candidateId(evaluation.candidateId),
    })),
    projectAssessments: payload.projectAssessments.map((assessment) => ({
      ...assessment,
      id: remapId(assessment.id),
      projectId: newProjectId,
    })),
    ruleEvidence: payload.ruleEvidence.map((evidence) => ({
      ...evidence,
      id: remapId(evidence.id),
      projectId: newProjectId,
      candidateId: candidateId(evidence.candidateId),
    })),
    candidateScores: payload.candidateScores.map((score) => ({
      ...score,
      projectId: newProjectId,
      candidateId: candidateId(score.candidateId),
    })),
    assessmentRuns: payload.assessmentRuns.map((run) => ({
      ...run,
      projectId: newProjectId,
      runId: remapId(run.runId),
    })),
    appMetadata: payload.appMetadata.map((metadata) => ({
      ...metadata,
      key: metadata.key.startsWith(oldMetadataPrefix)
        ? metadataPrefix(newProjectId) + metadata.key.slice(oldMetadataPrefix.length)
        : remapId(metadata.key),
    })),
  });
}
