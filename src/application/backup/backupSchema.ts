import { z } from "zod";
import { namingProfileSchema } from "../../domain/project/profile";
import { namingProjectSchema } from "../../domain/project/project";
import { generationBatchSchema } from "../../domain/generation/batch";
import { candidateSchema } from "../../domain/candidate/candidate";
import { candidateDecisionSchema } from "../../domain/candidate/decision";
import { candidateStageSchema } from "../../domain/candidate/decision";
import { candidateEvaluationSchema } from "../../domain/candidate/evaluation";
import { finalDecisionSchema } from "../../domain/candidate/finalDecision";
import { reviewedRiskSignalSchema } from "../../data/schema/runtimeBundle";
import { comparisonSnapshotSchema } from "../../domain/candidate/comparisonSnapshot";
import { sha256 } from "./checksum";

export const BACKUP_FORMAT = "erya-names-project-backup";
export const BACKUP_SCHEMA_VERSION = 3;

const sourceEvidenceSchema = z
  .object({
    sourceId: z.string().min(1),
    title: z.string().optional(),
    work: z.string().optional(),
    quote: z.string().optional(),
    location: z.string().optional(),
    excerpt: z.string().optional(),
    url: z.url().optional(),
    revision: z.string().min(1).optional(),
  })
  .strict();
const candidateRuleResultSchema = z
  .object({
    evidenceLevel: z.enum(["L1", "L2", "L3", "L4"]),
    outcome: z.enum(["pass", "warn", "reject", "unknown"]),
    ruleId: z.string().min(1),
    ruleVersion: z.string().min(1),
    explanation: z.string().min(1),
    sourceRefs: z.array(z.string()),
    scoreDelta: z.number().optional(),
  })
  .strict();
const generationBatchBackupSchema = generationBatchSchema
  .extend({
    profileSnapshot: namingProfileSchema,
  })
  .strict();
const candidateRecordSchema = candidateSchema
  .extend({
    sourceIds: z.array(z.string()),
    sourceEvidence: z.array(sourceEvidenceSchema),
    warnings: z.array(z.string()),
    riskSignals: z.array(reviewedRiskSignalSchema),
    ruleResults: z.array(candidateRuleResultSchema),
    // Early v1 records predate these derived evidence fields. Normalizing them
    // at the backup boundary keeps existing local projects exportable.
    styleTags: z.array(z.string()).default([]),
    characterElements: z.array(z.enum(["wood", "fire", "earth", "metal", "water"])).default([]),
    characterEvidence: z
      .array(
        z.object({
          char: z.string().length(1),
          pinyin: z.array(z.string()),
          meanings: z.array(z.string()),
          sourceRefs: z.array(z.string()),
        }),
      )
      .default([]),
  })
  .strict();
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
    revision: z.string().min(1).optional(),
  })
  .strict();
const ruleResultRecordSchema = z
  .object({
    id: z.string().min(1),
    projectId: z.string().min(1),
    candidateId: z.string().min(1),
    evidenceLevel: z.enum(["L1", "L2", "L3", "L4"]),
    outcome: z.enum(["pass", "warn", "reject", "unknown"]),
    ruleId: z.string().min(1),
    ruleVersion: z.string().min(1),
    explanation: z.string().min(1),
    sourceRefs: z.array(z.string()),
    scoreDelta: z.number().optional(),
  })
  .strict();
const decisionHistoryRecordSchema = z
  .object({
    id: z.number().int().positive().optional(),
    projectId: z.string().min(1),
    candidateId: z.string().min(1),
    from: candidateStageSchema,
    to: candidateStageSchema,
    action: z.enum(["manual", "auto_filter_confirmed"]).optional(),
    batchId: z.string().min(1).optional(),
    changedAt: z.iso.datetime(),
  })
  .strict();
export const backupPayloadSchema = z
  .object({
    projectId: z.string().min(1),
    projects: z.array(namingProjectSchema).length(1),
    profiles: z.array(namingProfileSchema),
    generationBatches: z.array(generationBatchBackupSchema),
    candidates: z.array(candidateRecordSchema),
    candidateSources: z.array(candidateSourceRecordSchema),
    ruleResults: z.array(ruleResultRecordSchema),
    candidateDecisions: z.array(candidateDecisionSchema),
    decisionHistory: z.array(decisionHistoryRecordSchema),
    candidateEvaluations: z.array(candidateEvaluationSchema),
    comparisonSnapshots: z.array(comparisonSnapshotSchema),
    finalDecisions: z.array(finalDecisionSchema),
  })
  .superRefine((payload, context) => {
    const projectId = payload.projectId;
    const projectOwned = [
      ...payload.profiles,
      ...payload.generationBatches,
      ...payload.candidates,
      ...payload.candidateSources,
      ...payload.ruleResults,
      ...payload.candidateDecisions,
      ...payload.decisionHistory,
      ...payload.candidateEvaluations,
      ...payload.comparisonSnapshots,
      ...payload.finalDecisions,
    ];
    if (
      payload.projects[0]?.id !== projectId ||
      projectOwned.some((record) => record.projectId !== projectId)
    ) {
      context.addIssue({
        code: "custom",
        message: "Backup contains records from a foreign project",
      });
    }
    if (
      payload.generationBatches.some((record) => record.profileSnapshot.projectId !== projectId)
    ) {
      context.addIssue({
        code: "custom",
        message: "Generation batch snapshot project does not match backup project",
      });
    }
    const batchIds = new Set(payload.generationBatches.map((record) => record.id));
    const candidateIds = new Set(payload.candidates.map((record) => record.id));
    const finalists = new Set(
      payload.candidateDecisions
        .filter((record) => record.stage === "finalist")
        .map((record) => record.candidateId),
    );
    if (
      payload.candidates.some(
        (record) => record.batchId !== null && !batchIds.has(record.batchId),
      )
    ) {
      context.addIssue({ code: "custom", message: "Candidate references a missing batch" });
    }
    const candidateReferences = [
      ...payload.candidateSources.map((record) => record.candidateId),
      ...payload.ruleResults.map((record) => record.candidateId),
      ...payload.candidateDecisions.map((record) => record.candidateId),
      ...payload.decisionHistory.map((record) => record.candidateId),
      ...payload.candidateEvaluations.map((record) => record.candidateId),
      ...payload.comparisonSnapshots.flatMap((record) => record.candidateIds),
    ];
    if (candidateReferences.some((candidateId) => !candidateIds.has(candidateId))) {
      context.addIssue({
        code: "custom",
        message: "Backup contains a dangling candidate reference",
      });
    }
    if (payload.finalDecisions.some((record) => !finalists.has(record.selectedCandidateId))) {
      context.addIssue({
        code: "custom",
        message: "Final decision must reference a finalist candidate",
      });
    }
  });

export const backupEnvelopeSchema = z.object({
  format: z.literal(BACKUP_FORMAT),
  schemaVersion: z.literal(BACKUP_SCHEMA_VERSION),
  appVersion: z.string().min(1),
  datasetVersion: z.string().min(1),
  rulePackVersion: z.string().min(1),
  exportedAt: z.iso.datetime(),
  checksum: z.string().regex(/^[a-f0-9]{64}$/),
  payload: backupPayloadSchema,
});

export type BackupPayload = z.infer<typeof backupPayloadSchema>;
export type BackupEnvelope = z.infer<typeof backupEnvelopeSchema>;

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
  const rawEnvelope = z
    .object({
      format: z.literal(BACKUP_FORMAT),
      schemaVersion: z.union([z.literal(1), z.literal(2), z.literal(BACKUP_SCHEMA_VERSION)]),
      appVersion: z.string().min(1),
      datasetVersion: z.string().min(1),
      rulePackVersion: z.string().min(1),
      exportedAt: z.iso.datetime(),
      checksum: z.string().regex(/^[a-f0-9]{64}$/),
      payload: z.unknown(),
    })
    .strict()
    .parse(input);
  if ((await sha256(rawEnvelope.payload)) !== rawEnvelope.checksum) {
    throw new Error("Backup checksum mismatch");
  }
  const payload =
    rawEnvelope.schemaVersion === 1
      ? backupPayloadSchema.parse(migrateV1Payload(rawEnvelope.payload))
      : backupPayloadSchema.parse(rawEnvelope.payload);
  return backupEnvelopeSchema.parse({
    ...rawEnvelope,
    schemaVersion: BACKUP_SCHEMA_VERSION,
    payload,
    checksum: await sha256(payload),
  });
}

function migrateV1Payload(input: unknown): unknown {
  if (!input || typeof input !== "object" || Array.isArray(input)) return input;
  const payload = input as Record<string, unknown>;
  const candidates = Array.isArray(payload.candidates)
    ? payload.candidates.map((candidate) =>
        candidate && typeof candidate === "object" && !Array.isArray(candidate)
          ? { styleTags: [], characterElements: [], characterEvidence: [], ...candidate }
          : candidate,
      )
    : payload.candidates;
  const candidateMap = new Map(
    (Array.isArray(candidates) ? candidates : [])
      .filter((candidate): candidate is Record<string, unknown> =>
        Boolean(candidate && typeof candidate === "object" && !Array.isArray(candidate)),
      )
      .map((candidate) => [String(candidate.id), candidate]),
  );
  const evaluations = new Map(
    (Array.isArray(payload.candidateEvaluations) ? payload.candidateEvaluations : [])
      .filter((evaluation): evaluation is Record<string, unknown> =>
        Boolean(evaluation && typeof evaluation === "object" && !Array.isArray(evaluation)),
      )
      .map((evaluation) => [String(evaluation.candidateId), evaluation]),
  );
  const snapshots = Array.isArray(payload.comparisonSnapshots)
    ? payload.comparisonSnapshots.flatMap((snapshot) => {
        if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot))
          return snapshot;
        const record = snapshot as Record<string, unknown>;
        const candidateIds = Array.isArray(record.candidateIds)
          ? record.candidateIds.map(String)
          : [];
        if (candidateIds.length < 2 || candidateIds.length > 5) return [];
        if (Array.isArray(record.candidates) && typeof record.name === "string")
          return [record];
        return [
          {
            ...record,
            name: `历史对比 ${String(record.createdAt ?? "")
              .slice(0, 16)
              .replace("T", " ")}`.trim(),
            candidates: candidateIds.map((candidateId) => {
              const candidate = candidateMap.get(candidateId) ?? {};
              const evaluation = evaluations.get(candidateId);
              const ruleEvidence = Array.isArray(candidate.ruleResults)
                ? candidate.ruleResults
                : [];
              return {
                id: candidateId,
                fullName: String(
                  candidate.fullName ?? candidate.normalizedFingerprint ?? candidateId,
                ),
                pinyin: Array.isArray(candidate.pinyin) ? candidate.pinyin : [],
                sourceType: candidate.sourceType ?? "user_input",
                summary: String(candidate.summary ?? ""),
                sourceEvidence: Array.isArray(candidate.sourceEvidence)
                  ? candidate.sourceEvidence
                  : [],
                warnings: ruleEvidence.filter(
                  (rule) =>
                    rule &&
                    typeof rule === "object" &&
                    !Array.isArray(rule) &&
                    (rule as Record<string, unknown>).outcome === "warn",
                ),
                ruleEvidence,
                ...(typeof evaluation?.rating === "number"
                  ? { rating: evaluation.rating }
                  : {}),
                ...(typeof evaluation?.note === "string" ? { note: evaluation.note } : {}),
              };
            }),
          },
        ];
      })
    : payload.comparisonSnapshots;
  return { ...payload, candidates, comparisonSnapshots: snapshots };
}
