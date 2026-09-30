import type { BackupRepository } from "../ports/BackupRepository";
import { validateBackupEnvelope } from "../../infrastructure/backup/backupSchema";
import { err, ok, type Result } from "../../domain/shared/result";

export interface BackupImportPreview {
  projectId: string;
  projectTitle: string;
  conflict: "none" | "project-id";
  counts: Record<string, number>;
}

export class PreviewBackupImport {
  constructor(private readonly repository: BackupRepository) {}

  async execute(input: unknown): Promise<Result<BackupImportPreview, string>> {
    try {
      const envelope = await validateBackupEnvelope(input);
      const counts = Object.fromEntries(
        Object.entries(envelope.payload)
          .filter(([, value]) => Array.isArray(value))
          .map(([key, value]) => [key, value.length]),
      );
      return ok({
        projectId: envelope.payload.projectId,
        projectTitle: String(envelope.payload.projects[0]?.title ?? "导入方案"),
        conflict: (await this.repository.hasProject(envelope.payload.projectId))
          ? "project-id"
          : "none",
        counts,
      });
    } catch (error) {
      return err(error instanceof Error ? error.message : "backup-preview-failed");
    }
  }
}
