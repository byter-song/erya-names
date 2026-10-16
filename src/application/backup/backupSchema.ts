import { candidateSchema } from "../../domain/candidate/candidate";
import { candidateDecisionSchema, candidatePoolSchema } from "../../domain/candidate/decision";
import { candidateEvaluationSchema } from "../../domain/candidate/evaluation";
import { generationBatchSchema } from "../../domain/generation/batch";
import { folkloreModuleIdSchema, namingProfileSchema } from "../../domain/project/profile";
import { namingProjectSchema } from "../../domain/project/project";
import { assessmentRunSchema } from "../../domain/rules/assessmentRun";
import { candidateScoreSchema } from "../../domain/rules/candidateScore";
import { ruleEvidenceSchema } from "../../domain/rules/result";
import { z, type Infer } from "../../domain/shared/zod";
import { sha256 } from "./checksum";

export const BACKUP_FORMAT = "erya-names-v2-project-backup";
export const BACKUP_SCHEMA_VERSION = 1;

export type BackupValidationErrorCode =
  "unsupported-format" | "invalid-checksum" | "invalid-payload";

export class BackupValidationError extends Error {
  constructor(
    readonly code: BackupValidationErrorCode,
    options?: ErrorOptions,
  ) {
    super(code, options);
    this.name = "BackupValidationError";
  }
}

const candidateSourceRecordSchema = z
  .object({
    id: z.string().min(1),
    projectId: z.string().min(1),
    candidateId: z.string().min(1),
    sourceId: z.string().min(1),
    title: z.string().optional(),
    work: z.string().optional(),
    quote: z.string().optional(),
    location: z.string().optional(),
    excerpt: z.string().optional(),
    url: z.url().optional(),
    revision: z.string().optional(),
  })
  .strict();

const decisionHistoryRecordSchema = z
  .object({
    id: z.number().int().positive().optional(),
    projectId: z.string().min(1),
    candidateId: z.string().min(1),
    from: candidatePoolSchema,
    to: candidatePoolSchema,
    action: z.enum(["forward", "backward", "exclude", "restore"]),
    exclusionReason: z.string().optional(),
    changedAt: z.iso.datetime(),
  })
  .strict();

const projectAssessmentRecordSchema = z
  .object({
    id: z.string().min(1),
    projectId: z.string().min(1),
    moduleId: folkloreModuleIdSchema,
    configRevision: z.number().int().nonnegative(),
    inputHash: z.string().min(1),
    result: z.record(z.string(), z.unknown()),
  })
  .strict();

const appMetadataRecordSchema = z
  .object({
    key: z.string().min(1),
    value: z.unknown(),
  })
  .strict();

/** V2 backups mirror the thirteen-table database contract exactly. */
export const backupPayloadSchema = z
  .object({
    projectId: z.string().min(1),
    projects: z.array(namingProjectSchema).length(1),
    profiles: z.array(namingProfileSchema).length(1),
    generationBatches: z.array(generationBatchSchema),
    candidates: z.array(candidateSchema),
    candidateSources: z.array(candidateSourceRecordSchema),
    candidateDecisions: z.array(candidateDecisionSchema),
    decisionHistory: z.array(decisionHistoryRecordSchema),
    candidateEvaluations: z.array(candidateEvaluationSchema),
    projectAssessments: z.array(projectAssessmentRecordSchema),
    ruleEvidence: z.array(ruleEvidenceSchema),
    candidateScores: z.array(candidateScoreSchema),
    assessmentRuns: z.array(assessmentRunSchema).max(1),
    appMetadata: z.array(appMetadataRecordSchema),
  })
  .strict()
  .superRefine((payload, context) => {
    const projectId = payload.projectId;
    const metadataKeyPrefix = `project:${projectId}:`;
    const projectOwned = [
      ...payload.profiles,
      ...payload.generationBatches,
      ...payload.candidates,
      ...payload.candidateSources,
      ...payload.candidateDecisions,
      ...payload.decisionHistory,
      ...payload.candidateEvaluations,
      ...payload.projectAssessments,
      ...payload.ruleEvidence,
      ...payload.candidateScores,
      ...payload.assessmentRuns,
    ];
    if (
      payload.projects[0]?.id !== projectId ||
      projectOwned.some((record) => record.projectId !== projectId)
    )
      context.addIssue({
        code: "custom",
        message: "Backup contains records from a foreign project",
      });

    if (payload.appMetadata.some(({ key }) => !key.startsWith(metadataKeyPrefix)))
      context.addIssue({
        code: "custom",
        message: "Backup contains metadata from a foreign project",
      });

    if (
      payload.generationBatches.some(
        ({ profileSnapshot }) => profileSnapshot.projectId !== projectId,
      )
    )
      context.addIssue({
        code: "custom",
        message: "Generation snapshot belongs to a foreign project",
      });

    const batchIds = new Set(payload.generationBatches.map(({ id }) => id));
    const candidateIds = new Set(payload.candidates.map(({ id }) => id));
    if (payload.candidates.some(({ batchId }) => batchId !== null && !batchIds.has(batchId)))
      context.addIssue({ code: "custom", message: "Candidate references a missing batch" });

    const referencedCandidateIds = [
      ...payload.candidateSources.map(({ candidateId }) => candidateId),
      ...payload.candidateDecisions.map(({ candidateId }) => candidateId),
      ...payload.decisionHistory.map(({ candidateId }) => candidateId),
      ...payload.candidateEvaluations.map(({ candidateId }) => candidateId),
      ...payload.ruleEvidence.map(({ candidateId }) => candidateId),
      ...payload.candidateScores.map(({ candidateId }) => candidateId),
    ];
    if (referencedCandidateIds.some((candidateId) => !candidateIds.has(candidateId)))
      context.addIssue({
        code: "custom",
        message: "Backup contains a dangling candidate reference",
      });

    const decisionCandidateIds = payload.candidateDecisions.map(
      ({ candidateId }) => candidateId,
    );
    const decisions = new Set(decisionCandidateIds);
    if (
      decisions.size !== decisionCandidateIds.length ||
      decisions.size !== candidateIds.size ||
      [...candidateIds].some((candidateId) => !decisions.has(candidateId))
    )
      context.addIssue({
        code: "custom",
        message: "Every candidate must have exactly one pool decision",
      });

    const uniqueCollections = [
      ["generation batch", payload.generationBatches.map(({ id }) => id)],
      ["candidate", payload.candidates.map(({ id }) => id)],
      ["candidate source", payload.candidateSources.map(({ id }) => id)],
      ["project assessment", payload.projectAssessments.map(({ id }) => id)],
      ["rule evidence", payload.ruleEvidence.map(({ id }) => id)],
      [
        "candidate evaluation",
        payload.candidateEvaluations.map(({ candidateId }) => candidateId),
      ],
      ["candidate score", payload.candidateScores.map(({ candidateId }) => candidateId)],
      ["metadata", payload.appMetadata.map(({ key }) => key)],
    ] as const;
    for (const [label, ids] of uniqueCollections) {
      if (new Set(ids).size !== ids.length)
        context.addIssue({
          code: "custom",
          message: `Backup contains duplicate ${label} records`,
        });
    }
  });

export const backupEnvelopeSchema = z
  .object({
    format: z.literal(BACKUP_FORMAT),
    schemaVersion: z.literal(BACKUP_SCHEMA_VERSION),
    appVersion: z.string().min(1),
    datasetVersion: z.string().min(1),
    rulePackVersion: z.string().min(1),
    exportedAt: z.iso.datetime(),
    checksum: z.string().regex(/^[a-f0-9]{64}$/),
    payload: backupPayloadSchema,
  })
  .strict();

export type BackupPayload = Infer<typeof backupPayloadSchema>;
export type BackupEnvelope = Infer<typeof backupEnvelopeSchema>;

export async function createBackupEnvelope(input: {
  payload: unknown;
  appVersion: string;
  datasetVersion: string;
  rulePackVersion: string;
  exportedAt: string;
}): Promise<BackupEnvelope> {
  const payload = backupPayloadSchema.parse(input.payload);
  return backupEnvelopeSchema.parse({
    format: BACKUP_FORMAT,
    schemaVersion: BACKUP_SCHEMA_VERSION,
    appVersion: input.appVersion,
    datasetVersion: input.datasetVersion,
    rulePackVersion: input.rulePackVersion,
    exportedAt: input.exportedAt,
    checksum: await sha256(payload),
    payload,
  });
}

export async function validateBackupEnvelope(input: unknown): Promise<BackupEnvelope> {
  if (
    !input ||
    typeof input !== "object" ||
    Array.isArray(input) ||
    (input as Record<string, unknown>).format !== BACKUP_FORMAT ||
    (input as Record<string, unknown>).schemaVersion !== BACKUP_SCHEMA_VERSION
  )
    throw new BackupValidationError("unsupported-format");

  const parsed = backupEnvelopeSchema.safeParse(input);
  if (!parsed.success)
    throw new BackupValidationError("invalid-payload", { cause: parsed.error });
  const envelope = parsed.data;
  if ((await sha256(envelope.payload)) !== envelope.checksum)
    throw new BackupValidationError("invalid-checksum");
  return envelope;
}

export function backupValidationErrorCode(
  error: unknown,
): BackupValidationErrorCode | undefined {
  return error instanceof BackupValidationError ? error.code : undefined;
}
