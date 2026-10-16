import type { BackupRepository } from "../ports/BackupRepository";
import {
  backupValidationErrorCode,
  type BackupValidationErrorCode,
  validateBackupEnvelope,
} from "../backup/backupSchema";
import type { CandidatePool } from "../../domain/candidate/decision";
import { err, ok, type Result } from "../../domain/shared/result";

export interface BackupImportPreview {
  format: "erya-names-v2-project-backup";
  schemaVersion: 1;
  projectId: string;
  projectTitle: string;
  exportedAt: string;
  conflict: "none" | "project-id";
  counts: Record<string, number>;
  poolCounts: Record<CandidatePool, number>;
}

export class PreviewBackupImport {
  constructor(private readonly repository: BackupRepository) {}

  async execute(
    input: unknown,
  ): Promise<Result<BackupImportPreview, BackupValidationErrorCode | "backup-preview-failed">> {
    try {
      const envelope = await validateBackupEnvelope(input);
      const counts = Object.fromEntries(
        Object.entries(envelope.payload)
          .filter(([, value]) => Array.isArray(value))
          .map(([key, value]) => [key, value.length]),
      );
      return ok({
        format: envelope.format,
        schemaVersion: envelope.schemaVersion,
        projectId: envelope.payload.projectId,
        projectTitle: String(envelope.payload.projects[0]?.title ?? "导入方案"),
        exportedAt: envelope.exportedAt,
        conflict: (await this.repository.hasProject(envelope.payload.projectId))
          ? "project-id"
          : "none",
        counts,
        poolCounts: envelope.payload.candidateDecisions.reduce<Record<CandidatePool, number>>(
          (totals, { pool }) => ({ ...totals, [pool]: totals[pool] + 1 }),
          { inspiration: 0, candidate: 0, selected: 0, excluded: 0 },
        ),
      });
    } catch (error) {
      return err(backupValidationErrorCode(error) ?? "backup-preview-failed");
    }
  }
}
